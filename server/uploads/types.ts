export type UploadFormat='xlsx'|'csv'|'tsv'|'txt'|'pdf'|'docx'|'png'|'jpeg'|'webp';
export interface SourceReference {filename:string;sheet?:string;page?:number;row?:number}
export interface ExtractedTable {headers:string[];rows:Record<string,string>[];source:SourceReference;rowSources?:SourceReference[]}
export interface ExtractedBlock {text:string;source:SourceReference}
export interface ExtractedDocument {format:UploadFormat;tables:ExtractedTable[];blocks:ExtractedBlock[];warnings:string[];templateId?:string}
export interface ExtractionLimits {maxBytes:number;maxRows:number;maxCells:number;maxTextPages:number;maxOcrPages:number;maxPixels:number;maxTextCharacters:number;timeoutMs:number}
export interface ExtractionOptions {limits?:Partial<ExtractionLimits>;signal?:AbortSignal;ocrEnabled?:boolean;ocrLanguages?:('eng'|'hin'|'mal')[];ocrDataPath?:string}
export interface UploadedFile {buffer:Buffer;filename:string}
export const extractionLimits:ExtractionLimits={maxBytes:10*1024*1024,maxRows:5000,maxCells:100000,maxTextPages:20,maxOcrPages:5,maxPixels:12_000_000,maxTextCharacters:5_000_000,timeoutMs:90_000};
