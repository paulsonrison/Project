import {extname} from 'node:path';
import {ApiError} from '../auth/scope.js';
import {extractionLimits,type ExtractionLimits,type UploadedFile,type UploadFormat} from './types.js';
const zip=Buffer.from([0x50,0x4b,0x03,0x04]),ole=Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]);
function starts(buffer:Buffer,signature:Buffer){return buffer.subarray(0,signature.length).equals(signature);}
export function detectFormat(file:UploadedFile,limits:ExtractionLimits=extractionLimits):UploadFormat {
  const {buffer,filename}=file,ext=extname(filename).toLowerCase();
  if(!buffer.length)throw new ApiError(400,'This file is empty. Choose a file containing records.');
  if(buffer.length>limits.maxBytes)throw new ApiError(400,'Choose a file smaller than 10 MB');
  if(starts(buffer,ole))throw new ApiError(400,'Unlock encrypted Office files or save older files as XLSX or DOCX before uploading.');
  const match=(valid:boolean,format:UploadFormat)=>{if(!valid)throw new ApiError(400,'The file contents do not match its format. Save a new copy and try again.');return format;};
  if(ext==='.xlsx'||ext==='.docx')return match(starts(buffer,zip),ext.slice(1) as 'xlsx'|'docx');
  if(ext==='.pdf')return match(buffer.subarray(0,1024).includes(Buffer.from('%PDF-')),'pdf');
  if(ext==='.png')return match(starts(buffer,Buffer.from([137,80,78,71,13,10,26,10])),'png');
  if(ext==='.jpg'||ext==='.jpeg')return match(starts(buffer,Buffer.from([255,216,255])),'jpeg');
  if(ext==='.webp')return match(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP','webp');
  if(['.csv','.tsv','.txt'].includes(ext)){
    const knownBinary=starts(buffer,zip)||buffer.subarray(0,5).toString()==='%PDF-'||starts(buffer,Buffer.from([137,80,78,71]));
    if(knownBinary)throw new ApiError(400,'The file contents do not match its text format.');
    return ext.slice(1) as 'csv'|'tsv'|'txt';
  }
  throw new ApiError(400,'This file format is not supported. Use XLSX, CSV, TSV, TXT, PDF, DOCX, PNG, JPEG or WebP.');
}
