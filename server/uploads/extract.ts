import {ApiError} from '../auth/scope.js';
import {detectFormat} from './detect.js';
import {extractText,textBlocksToDocument} from './extractors/text.js';
import {extractWorkbook} from './extractors/workbook.js';
import {extractDocx} from './extractors/docx.js';
import {extractPdf} from './extractors/pdf.js';
import {recognizeLocally,validateImageDimensions} from './extractors/image.js';
import {extractionLimits,type UploadedFile,type ExtractionOptions,type ExtractedDocument} from './types.js';
export type {ExtractedDocument,ExtractedTable,ExtractedBlock,ExtractionOptions,ExtractionLimits,SourceReference,UploadedFile,UploadFormat} from './types.js';
export async function extractFile(file:UploadedFile,options:ExtractionOptions={}):Promise<ExtractedDocument>{
  const limits={...extractionLimits,...options.limits},format=detectFormat(file,limits);
  const budget=AbortSignal.timeout(limits.timeoutMs);options={...options,signal:options.signal?AbortSignal.any([options.signal,budget]):budget};
  if(options.signal?.aborted)throw new ApiError(400,'Reading was cancelled.');
  const started=Date.now();let document:ExtractedDocument;
  if(format==='xlsx')document=await extractWorkbook(file.buffer,file.filename,limits);
  else if(format==='docx')document=await extractDocx(file.buffer,file.filename,limits);
  else if(format==='pdf')document=await extractPdf(file.buffer,file.filename,limits,options);
  else if(format==='csv'||format==='tsv'||format==='txt')document=extractText(file.buffer,file.filename,format,limits);
  else{
    validateImageDimensions(file.buffer,limits);
    const text=await recognizeLocally(file.buffer,options,limits);document=textBlocksToDocument(text,file.filename,format,limits);document.warnings.push('Scanned text needs careful review before saving.');
  }
  const rows=document.tables.reduce((sum,table)=>sum+table.rows.length,0),cells=document.tables.reduce((sum,table)=>sum+(table.rows.length+1)*table.headers.length,0),text=document.blocks.reduce((sum,block)=>sum+block.text.length,0);
  if(rows>limits.maxRows||cells>limits.maxCells||text>limits.maxTextCharacters)throw new ApiError(400,'The file exceeds the extraction limits. Split it into smaller files.');
  if(options.signal?.aborted)throw new ApiError(400,'Reading was cancelled.');
  if(Date.now()-started>limits.timeoutMs)throw new ApiError(400,'Reading took too long. Split the file into smaller files.');
  return document;
}
