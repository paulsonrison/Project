import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ApiError} from '../../auth/scope.js';
import {recognizeLocally} from './image.js';
import {tableFromMatrix,textBlocksToDocument} from './text.js';
import type {ExtractedDocument,ExtractionLimits,ExtractionOptions,SourceReference} from '../types.js';
interface TextPosition {text:string;x:number;y:number}
function positionedPage(items:TextPosition[],source:SourceReference,limits:ExtractionLimits){
  const lines:{y:number;items:TextPosition[]}[]=[];
  for(const item of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){
    let line=lines.find(row=>Math.abs(row.y-item.y)<2);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);
  }
  lines.forEach(line=>line.items.sort((a,b)=>a.x-b.x));
  const text=lines.map(line=>line.items.map(i=>i.text).join(' ')).join('\n');
  const headerIndex=lines.findIndex(line=>line.items.length>=2&&line.items.every(item=>item.text.trim()));
  if(headerIndex<0)return {text,table:null};
  const header=lines[headerIndex].items;
  if(new Set(header.map(item=>item.text.trim())).size!==header.length)return {text,table:null};
  const matrix=[header.map(item=>item.text)];
  for(const line of lines.slice(headerIndex+1)){
    const cells=header.map(()=>[] as string[]);
    for(const item of line.items){let column=0;for(let n=1;n<header.length;n++)if(item.x>=header[n].x-3)column=n;cells[column].push(item.text);}
    if(cells.filter(cell=>cell.length).length>=2)matrix.push(cells.map(cell=>cell.join(' ')));
  }
  return {text,table:matrix.length>1?tableFromMatrix(matrix,source,limits):null};
}
export async function extractPdf(buffer:Buffer,filename:string,limits:ExtractionLimits,options:ExtractionOptions):Promise<ExtractedDocument>{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const packageRoot=dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
  const loading=getDocument({data:new Uint8Array(buffer),enableXfa:false,useSystemFonts:true,stopAtErrors:true,disableFontFace:true,useWorkerFetch:false,standardFontDataUrl:pathToFileURL(join(packageRoot,'standard_fonts')+'/').href,cMapUrl:pathToFileURL(join(packageRoot,'cmaps')+'/').href,cMapPacked:true});
  const abort=()=>{void loading.destroy();};options.signal?.addEventListener('abort',abort,{once:true});
  let doc:Awaited<typeof loading.promise>|undefined,scans=0;
  try{
    doc=await loading.promise;
    if(doc.numPages>limits.maxTextPages)throw new ApiError(400,'This PDF has too many pages. Upload at most 20 text pages or split it.');
    const result:ExtractedDocument={format:'pdf',tables:[],blocks:[],warnings:[]};
    for(let n=1;n<=doc.numPages;n++){
      if(options.signal?.aborted)throw new ApiError(400,'Reading was cancelled.');
      const page=await doc.getPage(n),content=await page.getTextContent();
      const items=content.items.filter((item):item is typeof item&{str:string;transform:number[]}=>'str'in item&&'transform'in item).map(item=>({text:item.str,x:item.transform[4],y:item.transform[5]})).filter(item=>item.text.trim());
      const source={filename,page:n};
      if(items.length){
        const parsed=positionedPage(items,source,limits);if(parsed.table)result.tables.push(parsed.table);result.blocks.push({text:parsed.text,source});
      }else{
        if(!options.ocrEnabled)throw new ApiError(400,'This PDF contains scanned pages. Local image reading is not enabled yet; use a text PDF or spreadsheet.');
        scans++;if(scans>limits.maxOcrPages)throw new ApiError(400,'This PDF has too many scanned pages. Upload at most 5 scanned pages.');
        const viewport=page.getViewport({scale:1.5});if(viewport.width*viewport.height>limits.maxPixels)throw new ApiError(400,'This PDF page exceeds the decoded pixel limit.');
        const {createCanvas}=await import('@napi-rs/canvas');const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
        await page.render({canvasContext:canvas.getContext('2d') as unknown as CanvasRenderingContext2D,viewport,canvas:canvas as unknown as HTMLCanvasElement}).promise;
        const text=await recognizeLocally(canvas.toBuffer('image/png'),options,limits),parsed=textBlocksToDocument(text,filename,'pdf',limits,n);
        result.tables.push(...parsed.tables);result.blocks.push(...parsed.blocks);result.warnings.push('Scanned text needs careful review before saving.');
      }
      page.cleanup();
    }
    return result;
  }catch(error){
    if(error instanceof ApiError)throw error;
    if(error instanceof Error&&/password|encrypt/i.test(error.name+' '+error.message))throw new ApiError(400,'Unlock this PDF before uploading it.');
    throw new ApiError(400,'This PDF could not be read. Save a new unlocked PDF copy and try again.');
  }finally{options.signal?.removeEventListener('abort',abort);await loading.destroy();}
}
