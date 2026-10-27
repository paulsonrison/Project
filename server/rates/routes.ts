import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AccessScope, Publication, RateInterval } from '../../shared/contracts.js';
import type { Dependencies } from '../app.js';
import type { Entity } from '../db/connect.js';
import { ApiError, requireRole } from '../auth/scope.js';
import { dailyRateHistory, previewRateChange, rateChangeSchema } from './intervals.js';
import { resolvePrice } from '../domain/rules.js';

interface RatePreview extends Entity { publicationId:string; expectedRevision:number; rateIntervals:RateInterval[]; expiresAt:Date; committed?:boolean }
export function ratesRoutes({ db, client }: Dependencies) {
  const router = Router();
  router.use((_req,res,next) => { requireRole(res.locals.scope as AccessScope,'admin'); next(); });
  router.get('/:id/history', async (req,res) => {
    const scope:AccessScope = res.locals.scope, month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);
    const paper = await db.collection<Entity>('publications').findOne({id:req.params.id,societyId:scope.societyId});
    if (!paper) throw new ApiError(404,'Newspaper not found');
    const rates = dailyRateHistory(paper as unknown as Publication,month);
    const snapshots = await db.collection('deliveries').find({societyId:scope.societyId,publicationId:paper.id,date:{$gte:`${month}-01`,$lt:`${month}-32`}}, {projection:{_id:0,date:1,priceMinor:1,billableQuantity:1,status:1,invoiceId:1}}).toArray();
    res.json({items:rates.map(day=>({...day, snapshots:snapshots.filter(s=>s.date===day.date)}))});
  });
  router.post('/:id/preview', async (req,res) => {
    const scope:AccessScope = res.locals.scope;
    const { revision, ...raw } = z.object({revision:z.number().int().min(0)}).passthrough().parse(req.body);
    const input = rateChangeSchema.parse(raw);
    const paper = await db.collection<Entity>('publications').findOne({id:req.params.id,societyId:scope.societyId,archived:{$ne:true}});
    if (!paper) throw new ApiError(404,'Newspaper not found');
    if (paper.revision!==revision) throw new ApiError(409,'This newspaper changed. Refresh and retry.');
    let preview;
    try { preview = previewRateChange(paper as unknown as Publication,input); } catch (error) { if (error instanceof z.ZodError) throw error; throw new ApiError(409,error instanceof Error?error.message:'Invalid rate change'); }
    const affected = await db.collection('deliveries').find({societyId:scope.societyId,publicationId:paper.id,date:{$gte:input.validFrom,...(input.toDate?{$lte:input.toDate}:{})}}).toArray();
    const changed = affected.filter(day=>{try{return resolvePrice(preview.publication,day.date)!==day.priceMinor;}catch{return true;}});
    const billed = changed.filter(day=>day.invoiceId);
    const id = randomUUID();
    await db.collection<RatePreview>('ratePreviews').insertOne({id,societyId:scope.societyId,revision:0,publicationId:paper.id,expectedRevision:revision,rateIntervals:preview.publication.rateIntervals!,expiresAt:new Date(Date.now()+15*60*1000)});
    res.json({id, publicationId:paper.id, intervals:preview.publication.rateIntervals, migratedLegacy:preview.migratedLegacy, gapsAfter:preview.gapsAfter, billedDatesUnchanged:billed.length, unresolvedDates:changed.filter(d=>['pending','paused'].includes(d.status)).length, notice:'Issued bills and recorded delivered prices stay unchanged. Use a reviewed credit or debit adjustment for past billing corrections.'});
  });
  router.post('/previews/:id/commit', async (req,res) => {
    const scope:AccessScope = res.locals.scope, tx=client.startSession();
    try {
      let publicationId='';
      await tx.withTransaction(async()=>{
        const preview = await db.collection<RatePreview>('ratePreviews').findOne({id:req.params.id,societyId:scope.societyId},{session:tx});
        if(!preview)throw new ApiError(404,'Rate preview not found');
        publicationId=preview.publicationId;
        if(preview.committed)return;
        if(preview.expiresAt<new Date())throw new ApiError(409,'Rate preview expired. Preview again.');
        const updated=await db.collection<Entity>('publications').updateOne({id:preview.publicationId,societyId:scope.societyId,revision:preview.expectedRevision},{$set:{pricingVersion:2,rateIntervals:preview.rateIntervals},$inc:{revision:1}},{session:tx});
        if(!updated.matchedCount)throw new ApiError(409,'This newspaper changed. Preview again.');
        await db.collection('ratePreviews').updateOne({id:preview.id,societyId:scope.societyId},{$set:{committed:true}},{session:tx});
        await db.collection('audit').insertOne({id:randomUUID(),societyId:scope.societyId,userId:scope.userId,type:'rate-change',publicationId,previewId:preview.id,at:new Date().toISOString()},{session:tx});
      });
      res.json({ok:true,publicationId});
    }finally{await tx.endSession();}
  });
  return router;
}
