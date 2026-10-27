import {Router,json} from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import type {AccessScope} from '../../shared/contracts.js';
import type {Dependencies} from '../app.js';
import {ApiError,requireRole} from '../auth/scope.js';
import {createPreview,commitPreview} from '../imports/service.js';
import {paperCode,type ImportRecord} from '../imports/workbook.js';
import {resolveAiConfig} from '../preferences/service.js';
import {extractFile} from './extract.js';
import {normalizeDocument,type CatalogPaper} from './normalize.js';
import {interpretStructure} from './interpret.js';
const active=new Map<string,AbortController>();
const processing=new Set(['uploaded','extracting','interpreting']);
export function uploadRoutes(deps:Dependencies){
  const {db,client,config}=deps,router=Router(),jobs=db.collection('uploadJobs');
  router.use((_req,res,next)=>{requireRole(res.locals.scope,'admin');next();});
  router.use(rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false}));
  const owner=(scope:AccessScope,id:string)=>({id,societyId:scope.societyId,userId:scope.userId});
  async function owned(scope:AccessScope,id:string){const job=await jobs.findOne({...owner(scope,id),expiresAt:{$gt:new Date()}},{projection:{_id:0}});if(!job)throw new ApiError(404,'Upload not found. Choose the file again.');return job;}
  async function processJob(scope:AccessScope,id:string,file:{buffer:Buffer;filename:string}){
    const controller=new AbortController();active.set(id,controller);const timer=setTimeout(()=>controller.abort(),90000);
    const filter={...owner(scope,id),status:{$nin:['cancelled','completed']}};
    try{
      await jobs.updateOne(filter,{$set:{status:'extracting'}});
      const document=await extractFile(file,{signal:controller.signal,ocrEnabled:config.ocrEnabled,ocrDataPath:config.ocrDataPath||resolve('server/ocr-data'),ocrLanguages:['eng','hin','mal']});
      if(controller.signal.aborted)throw new ApiError(400,'Reading stopped. Try a smaller or clearer file.');
      const job=await owned(scope,id);
      const papers=(await db.collection<ImportRecord>('publications').find({societyId:scope.societyId,archived:{$ne:true}},{projection:{id:1,code:1,name:1}}).toArray()).map(p=>({id:p.id,code:paperCode(p),name:String(p.name)}));
      const normalized=normalizeDocument(document,job.entity,papers as CatalogPaper[]);
      if(Buffer.byteLength(JSON.stringify(normalized))>6*1024*1024)throw new ApiError(400,'Too much data in one file. Split it into smaller files.');
      await jobs.updateOne(filter,{$set:{status:'interpreting'}});
      let interpretation:{aiUsed:boolean;notice?:string};
      try{interpretation=await interpretStructure(await resolveAiConfig(db,config,scope),normalized);}catch{interpretation={aiUsed:false,notice:'Your AI service is unavailable. Check Settings or review the extracted details.'};}
      if(controller.signal.aborted)throw new ApiError(400,'Reading stopped. Try a smaller or clearer file.');
      await jobs.updateOne(filter,{$set:{status:'needs-review',rows:normalized.rows,issues:normalized.issues,unmapped:normalized.unmapped,sources:normalized.sources,columns:normalized.columns,warnings:document.warnings,...interpretation,templateId:document.templateId||null},$inc:{revision:1}});
    }catch(error){await jobs.updateOne(filter,{$set:{status:'failed',error:error instanceof ApiError?error.message:'We could not read this file. Try a clear table or another file.'},$unset:{rows:'',sources:''}});}
    finally{clearTimeout(timer);active.delete(id);file.buffer=Buffer.alloc(0);}
  }
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:2}});
  router.post('/',upload.single('file'),async(req,res)=>{
    if(active.size>=1)throw new ApiError(429,'Another file is being read. Please try again shortly.');
    if(!req.file)throw new ApiError(400,'Choose a file to upload.');
    const entity=z.enum(['residents','publications']).parse(req.body.entity),id=randomUUID(),scope:AccessScope=res.locals.scope;
    active.set(id,new AbortController());
    try{await jobs.insertOne({id,societyId:scope.societyId,userId:scope.userId,entity,filename:req.file.originalname.slice(0,200),revision:0,status:'uploaded',createdAt:new Date(),expiresAt:new Date(Date.now()+24*3600000)});}catch(error){active.delete(id);throw error;}
    void processJob(scope,id,{buffer:req.file.buffer,filename:req.file.originalname});
    res.status(202).json({id,status:'uploaded'});
  });
  router.get('/:id',async(req,res)=>{
    const job=await owned(res.locals.scope,String(req.params.id));
    if(processing.has(job.status)&&!active.has(job.id)){await jobs.updateOne(owner(res.locals.scope,job.id),{$set:{status:'failed',error:'Reading was interrupted. Choose the file again.'}});job.status='failed';job.error='Reading was interrupted. Choose the file again.';}
    res.json(job);
  });
  router.post('/:id/preview',json({limit:'12mb'}),async(req,res)=>{
    const scope:AccessScope=res.locals.scope,job=await owned(scope,String(req.params.id));
    if(job.status!=='needs-review')throw new ApiError(409,'This upload is not ready to save.');
    const input=z.object({rows:z.array(z.record(z.string(),z.string().max(2000))).max(5000),mode:z.enum(['add','update','remove','replace']).default('add'),effectiveDate:z.iso.date().optional(),revision:z.number().int(),acknowledgeIssues:z.boolean().default(false)}).parse(req.body);
    if(job.issues?.length&&!input.acknowledgeIssues)throw new ApiError(400,'Check the uncertain fields before saving.');
    if(input.revision!==job.revision)throw new ApiError(409,'The upload changed. Check the details again.');
    const rows=input.rows;
    if(input.mode==='update'){
      const existing=await db.collection(job.entity).find({societyId:scope.societyId,archived:{$ne:true}}).toArray();
      for(const row of rows){const key=job.entity==='residents'?'Customer ID':'Newspaper ID';if(row[key])continue;
        const matches=existing.filter(r=>job.entity==='residents'?String(r.name).toLowerCase()===String(row.Name).toLowerCase()&&String(r.unit).toLowerCase()===String(row['Address/Flat']).toLowerCase():row.Code&&paperCode(r as unknown as ImportRecord)===row.Code.toUpperCase());
        if(matches.length===1){row[key]=String(matches[0].id);row.Revision=String(matches[0].revision);}
      }
    }
    const preview=await createPreview(db,scope,{entity:job.entity,mode:input.mode,rows,effectiveDate:input.effectiveDate,...(job.templateId&&['remove','replace'].includes(input.mode)?{templateId:job.templateId}:{})});
    const changed=await jobs.updateOne({...owner(scope,job.id),revision:job.revision,status:'needs-review'},{$set:{batchId:preview.id},$inc:{revision:1}});
    if(!changed.matchedCount)throw new ApiError(409,'The upload changed. Check the details again.');
    res.json({...preview,revision:job.revision+1});
  });
  router.post('/:id/save',async(req,res)=>{
    const scope:AccessScope=res.locals.scope,job=await owned(scope,String(req.params.id));
    const batchId=z.string().uuid().parse(req.body.batchId);
    if(job.batchId!==batchId||!['needs-review','saving','completed'].includes(job.status))throw new ApiError(409,'Review these details again before saving.');
    const locked=await jobs.updateOne({...owner(scope,job.id),batchId,status:{$in:['needs-review','saving','completed']}},{$set:{status:'saving'}});
    if(!locked.matchedCount)throw new ApiError(409,'The upload changed. Check the details again.');
    let result;
    try{result=await commitPreview(db,client,scope,batchId);}catch(error){await jobs.updateOne({...owner(scope,job.id),status:'saving'},{$set:{status:'needs-review'}});throw error;}
    await jobs.updateOne(owner(scope,job.id),{$set:{status:'completed',result},$unset:{rows:'',sources:'',unmapped:'',issues:'',columns:''}});
    res.json(result);
  });
  router.delete('/:id',async(req,res)=>{const scope:AccessScope=res.locals.scope,job=await owned(scope,String(req.params.id));if(['completed','saving'].includes(job.status))throw new ApiError(409,'These records are being saved or have already been saved.');active.get(job.id)?.abort();await jobs.updateOne({...owner(scope,job.id),status:{$nin:['saving','completed']}},{$set:{status:'cancelled'},$unset:{rows:'',sources:'',unmapped:'',issues:'',columns:''}});res.sendStatus(204);});
  return router;
}
