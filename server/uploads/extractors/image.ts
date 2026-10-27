import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {ApiError} from '../../auth/scope.js';
import type {ExtractionLimits,ExtractionOptions} from '../types.js';
let activeOcr=false;
export function imageDimensions(buffer:Buffer):{width:number;height:number}|undefined{
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buffer.length>=24)return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(buffer[0]===0xff&&buffer[1]===0xd8){
    let offset=2;
    while(offset+4<buffer.length){if(buffer[offset]!==0xff){offset++;continue;}const marker=buffer[offset+1];if(marker===0xd9||marker===0xda)break;const length=buffer.readUInt16BE(offset+2);if(length<2)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&offset+9<buffer.length)return {width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5)};offset+=2+length;}
  }
  if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP'){
    const kind=buffer.subarray(12,16).toString();
    if(kind==='VP8X'&&buffer.length>=30)return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};
    if(kind==='VP8L'&&buffer.length>=25){const bits=buffer.readUInt32LE(21);return {width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};}
    if(kind==='VP8 '&&buffer.length>=30&&buffer.subarray(23,26).equals(Buffer.from([0x9d,1,0x2a])))return {width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff};
  }
}
export function validateImageDimensions(buffer:Buffer,limits:ExtractionLimits){
  const size=imageDimensions(buffer);
  if(!size||!size.width||!size.height||size.width*size.height>limits.maxPixels)throw new ApiError(400,'This image is invalid or exceeds the decoded pixel limit. Use a smaller clear image.');
  return size;
}
export async function recognizeLocally(buffer:Buffer,options:ExtractionOptions,limits:ExtractionLimits):Promise<string>{
  if(!options.ocrEnabled)throw new ApiError(400,'Image and scanned-PDF reading is not enabled on this server yet. Use a text PDF, spreadsheet or document.');
  if(!options.ocrDataPath)throw new ApiError(503,'Local OCR language files are not configured. No image was sent to an AI provider.');
  const languages=options.ocrLanguages?.length?options.ocrLanguages:['eng'];
  if(languages.some(lang=>!['eng','hin','mal'].includes(lang)||!existsSync(join(options.ocrDataPath!,`${lang}.traineddata.gz`))))throw new ApiError(503,'The selected local OCR language files are unavailable. No image was sent to an AI provider.');
  validateImageDimensions(buffer,limits);
  if(activeOcr)throw new ApiError(429,'Another image is being read. Please retry shortly.');
  activeOcr=true;
  let worker:Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const abort=()=>{void worker?.terminate();};options.signal?.addEventListener('abort',abort,{once:true});
  try{
    const {createWorker}=await import('tesseract.js');
    const work=(async()=>{worker=await createWorker(languages,1,{langPath:options.ocrDataPath,cacheMethod:'readOnly',gzip:true,logger:()=>{},errorHandler:()=>{}});if(options.signal?.aborted)throw new Error('cancelled');await worker.setParameters({preserve_interword_spaces:'1'});const {data}=await worker.recognize(buffer,{rotateAuto:true}, {text:true,blocks:false});return data.text;})();
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort();reject(new ApiError(400,'Reading this image took too long. Use a smaller, clearer image.'));},limits.timeoutMs);});
    return await Promise.race([work,timeout]);
  }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'This image could not be read locally. Try a clearer image or a text file.');}
  finally{if(timer)clearTimeout(timer);options.signal?.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});activeOcr=false;}
}
