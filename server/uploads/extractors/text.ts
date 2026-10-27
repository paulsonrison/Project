import {parse} from 'csv-parse/sync';
import {ApiError} from '../../auth/scope.js';
import type {ExtractedDocument,ExtractionLimits,SourceReference,UploadFormat} from '../types.js';
export function decodeText(buffer:Buffer):string {
  if(buffer.length>=2&&buffer[0]===0xff&&buffer[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(buffer.subarray(2));
  if(buffer.length>=2&&buffer[0]===0xfe&&buffer[1]===0xff)return new TextDecoder('utf-16be',{fatal:true}).decode(buffer.subarray(2));
  try {const value=new TextDecoder('utf-8',{fatal:true}).decode(buffer);if(value.includes('\0'))throw new Error();return value;}catch{throw new ApiError(400,'This text encoding is not supported. Save the file as UTF-8 and try again.');}
}
export function tableFromMatrix(matrix:string[][],source:SourceReference,limits:ExtractionLimits){
  const useful=matrix.filter(row=>row.some(cell=>cell.trim()));
  if(useful.length<1)return null;
  const headers=useful[0].map(h=>h.trim());
  if(!headers.length||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new ApiError(400,'Column headings must be present and unique.');
  if(useful.length-1>limits.maxRows||useful.reduce((n,row)=>n+row.length,0)>limits.maxCells)throw new ApiError(400,'The file exceeds the row or cell limit. Split it into smaller files.');
  if(useful.some(row=>row.length!==headers.length))throw new ApiError(400,'Some rows have different numbers of fields. Check the file before uploading.');
  const rows=useful.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i].trim()])));
  return {headers,rows,source,rowSources:rows.map((_,i)=>({...source,row:i+2}))};
}
export function extractText(buffer:Buffer,filename:string,format:'csv'|'tsv'|'txt',limits:ExtractionLimits):ExtractedDocument{
  const text=decodeText(buffer).replace(/^\ufeff/,'');
  if(text.length>limits.maxTextCharacters)throw new ApiError(400,'The file contains too much text. Split it into smaller files.');
  const source={filename};
  const lines=text.split(/\r?\n/).filter(line=>line.trim());
  if(format==='txt'){
    const labels=/^(name|full name|customer|customer name|phone|number|mobile|address|flat|unit|flat number|start date|subscriptions?|newspaper|code|price|rate|from date|to date|नाम|मोबाइल|फोन|पता|फ्लैट|പേര്|ഫോൺ|ഫോണ്|വിലാസം|ഫ്ലാറ്റ്|നിരക്ക്)$/i;
    const pairs=lines.map(line=>line.match(/^([^:]{1,60}):\s*(.*)$/));
    if(pairs.length>=2&&pairs.every(pair=>pair&&labels.test(pair[1].trim()))){const headers=pairs.map(pair=>pair![1].trim());if(new Set(headers).size===headers.length)return {format,tables:[{headers,rows:[Object.fromEntries(pairs.map(pair=>[pair![1].trim(),pair![2].trim()]))],source,rowSources:[{...source,row:1}]}],blocks:[],warnings:[]};}
  }
  const first=lines[0]??'';
  const spaced=format==='txt'&&/\S\s{2,}\S/.test(first)&&lines.length>1;
  const delimiter=format==='tsv'?'\t':format==='csv'?(first.includes(';')&&!first.includes(',')?';':','):first.includes('\t')?'\t':first.includes(',')?',':first.includes('|')?'|':spaced?'\t':undefined;
  if(!delimiter)return {format,tables:[],blocks:[{text,source}],warnings:['Text needs review to identify its record fields.']};
  let matrix:string[][];
  try{matrix=parse(spaced?lines.map(line=>line.trim().split(/\s{2,}/).join('\t')).join('\n'):text,{delimiter,bom:true,skip_empty_lines:true,relax_column_count:false,max_record_size:Math.min(limits.maxTextCharacters,100_000),to:limits.maxRows+2,cast:false}) as string[][];}catch{if(format==='txt')return {format,tables:[],blocks:[{text,source}],warnings:['Text needs review to identify its record fields.']};throw new ApiError(400,'This table could not be read. Check quotes, separators and row lengths.');}
  const table=tableFromMatrix(matrix,source,limits);
  return {format,tables:table?[table]:[],blocks:[],warnings:[]};
}
export function textBlocksToDocument(text:string,filename:string,format:UploadFormat,limits:ExtractionLimits,page?:number):ExtractedDocument{
  const inferred=extractText(Buffer.from(text),filename,'txt',limits);
  return {...inferred,format,tables:inferred.tables.map(table=>({...table,source:{...table.source,...(page?{page}:{})}})),blocks:inferred.blocks.map(block=>({...block,source:{...block.source,...(page?{page}:{})}}))};
}
