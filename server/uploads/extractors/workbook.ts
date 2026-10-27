import ExcelJS from 'exceljs';
import {ApiError} from '../../auth/scope.js';
import {checkZip} from '../../imports/workbook.js';
import {tableFromMatrix} from './text.js';
import type {ExtractedDocument,ExtractionLimits} from '../types.js';
export async function extractWorkbook(buffer:Buffer,filename:string,limits:ExtractionLimits):Promise<ExtractedDocument>{
  let sourceCells=0;
  checkZip(buffer,(name,contents)=>{if(/^xl\/worksheets\/.*\.xml$/.test(name)){sourceCells+=(contents.toString('utf8').match(/<c(?:\s|>)/g)||[]).length;if(sourceCells>limits.maxCells)throw new ApiError(400,'This workbook exceeds the cell limit. Split it into smaller files.');}});
  if(!buffer.includes(Buffer.from('xl/workbook.xml')))throw new ApiError(400,'This file is not an XLSX workbook.');
  const book=new ExcelJS.Workbook();
  try{await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);}catch{throw new ApiError(400,'This workbook could not be read. Upload an unlocked XLSX file.');}
  const template=book.getWorksheet('_Template'),isTemplate=template?.getCell('B1').text==='1';
  const result:ExtractedDocument={format:'xlsx',tables:[],blocks:[],warnings:[],...(isTemplate&&template?.getCell('B2').text?{templateId:template.getCell('B2').text}:{})};
  let totalCells=0,totalRows=0;
  for(const sheet of book.worksheets){
    if(isTemplate&&['Instructions','Newspapers','Rates','_Template'].includes(sheet.name))continue;
    if(sheet.state==='veryHidden'||sheet.state==='hidden')continue;
    if(sheet.rowCount>limits.maxRows+1||sheet.columnCount>200)throw new ApiError(400,'This workbook exceeds the row or column limit.');
    totalCells+=sheet.rowCount*sheet.columnCount;totalRows+=Math.max(0,sheet.rowCount-1);
    if(totalCells>limits.maxCells||totalRows>limits.maxRows)throw new ApiError(400,'This workbook exceeds the total row or cell limit. Split it into smaller files.');
    const matrix:string[][]=[];
    sheet.eachRow(row=>{
      const values:string[]=[];
      for(let n=1;n<=sheet.columnCount;n++){
        const cell=row.getCell(n),value=cell.value;
        if(value&&typeof value==='object'&&('formula'in value||'sharedFormula'in value||'hyperlink'in value))throw new ApiError(400,'Formulas and links are not supported. Paste plain values before uploading.');
        values.push(value instanceof Date?value.toISOString().slice(0,10):cell.text);
      }
      matrix.push(values);
    });
    const table=tableFromMatrix(matrix,{filename,sheet:sheet.name},limits);if(table)result.tables.push(table);
  }
  if(!result.tables.length)throw new ApiError(400,'No visible table was found in this workbook.');
  return result;
}
