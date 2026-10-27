import mammoth from 'mammoth';
import {ApiError} from '../../auth/scope.js';
import {checkZip} from '../../imports/workbook.js';
import {tableFromMatrix,textBlocksToDocument} from './text.js';
import type {ExtractedDocument,ExtractionLimits} from '../types.js';
interface DocumentNode {type:string;value?:string;children?:DocumentNode[];colSpan?:number;rowSpan?:number}
function nodeText(node:DocumentNode):string{return node.type==='text'?node.value??'':node.type==='tab'?'\t':(node.children??[]).map(nodeText).join('');}
export async function extractDocx(buffer:Buffer,filename:string,limits:ExtractionLimits):Promise<ExtractedDocument>{
  checkZip(buffer,(name,contents)=>{if(name==='word/document.xml'&&contents.length>limits.maxTextCharacters*2)throw new ApiError(400,'This document exceeds the text limit. Split it into smaller files.');});
  if(!buffer.includes(Buffer.from('word/document.xml')))throw new ApiError(400,'This file is not a DOCX document.');
  try{
    const document:ExtractedDocument={format:'docx',tables:[],blocks:[],warnings:[]};
    // Read Mammoth's document tree so table cells do not collapse into paragraph text.
    // Generated HTML is never returned, rendered or sent to a provider; external file
    // access and embedded style maps are disabled and images are not read.
    await mammoth.convertToHtml({buffer},{externalFileAccess:false,includeEmbeddedStyleMap:false,includeDefaultStyleMap:false,convertImage:mammoth.images.imgElement(async()=>({src:''})),transformDocument:(root:DocumentNode)=>{
      const visit=(node:DocumentNode)=>{
        if(node.type==='table'){
          const rows=(node.children??[]).filter(child=>child.type==='tableRow');
          const merged=rows.some(row=>(row.children??[]).some(cell=>(cell.colSpan??1)>1||(cell.rowSpan??1)>1));
          if(merged){document.blocks.push({text:rows.map(row=>(row.children??[]).map(nodeText).join('\t')).join('\n'),source:{filename}});document.warnings.push('Merged table cells need review.');}
          else{const table=tableFromMatrix(rows.map(row=>(row.children??[]).map(nodeText)),{filename},limits);if(table)document.tables.push(table);}return;
        }
        if(node.type==='paragraph'){const text=nodeText(node);if(text.trim()){const parsed=textBlocksToDocument(text,filename,'docx',limits);document.tables.push(...parsed.tables);document.blocks.push(...parsed.blocks);}return;}
        (node.children??[]).forEach(visit);
      };visit(root);return root;
    }});
    return document;
  }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'This document could not be read. Save an unlocked DOCX copy and try again.');}
}
