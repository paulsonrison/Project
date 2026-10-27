import { Router, json } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import type { Dependencies } from '../app.js';
import { requireRole, ApiError } from '../auth/scope.js';
import { buildWorkbook, parseWorkbook } from './workbook.js';
import { createPreview, commitPreview, templateContext } from './service.js';
export function importRoutes({db,client}:Dependencies) {
  const router=Router();
  router.use((_req,res,next)=>{requireRole(res.locals.scope,'admin');next();});
  router.use(rateLimit({windowMs:60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{message:'Too many imports. Please wait a minute.'}}}));
  router.post('/template',async(req,res)=>{
    const input=z.object({entity:z.enum(['residents','publications']),mode:z.enum(['add','update','remove','replace']),locale:z.enum(['en','hi','ml']).default('en'),selection:z.array(z.string()).max(5000).optional()}).parse(req.body);
    const context=await templateContext(db,res.locals.scope,input.entity,input.mode,input.locale,input.selection);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`presstrack-${input.entity}-${input.mode}.xlsx`).send(await buildWorkbook(context));
  });
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:5},fileFilter:(_req,file,cb)=>{if(!file.originalname.toLowerCase().endsWith('.xlsx'))return cb(new ApiError(400,'Upload an unlocked .xlsx workbook'));cb(null,true);}});
  router.post('/upload',upload.single('file'),async(req,res)=>{
    if(!req.file)throw new ApiError(400,'Choose an Excel workbook');
    const parsed=await parseWorkbook(req.file.buffer);
    // Parsing and field mapping are separate from review; no writes to business records occur here.
    res.json(parsed);
  });
  router.post('/preview',json({limit:'12mb'}),async(req,res)=>res.json(await createPreview(db,res.locals.scope,req.body)));
  router.post('/:id/commit',async(req,res)=>res.json(await commitPreview(db,client,res.locals.scope,String(req.params.id))));
  router.get('/:id/errors',async(req,res)=>{
    const batch=await db.collection('importBatches').findOne({id:req.params.id,societyId:res.locals.scope.societyId,userId:res.locals.scope.userId});
    if(!batch)throw new ApiError(404,'Preview not found');
    const book=new ExcelJS.Workbook(), sheet=book.addWorksheet('Errors');sheet.addRow(['Row','Correction needed']);for(const error of batch.errors)sheet.addRow([error.row,error.message]);sheet.getColumn(2).width=100;
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('import-errors.xlsx').send(Buffer.from(await book.xlsx.writeBuffer()));
  });
  return router;
}
