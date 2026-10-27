import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Dependencies } from '../app.js';
import { getPreferences,removeCustomKey,rotateCustomKey,saveCandidateKey,testCandidateKey,updatePreferences } from './service.js';
export function preferencesRoutes({db,client,config}:Dependencies){
  const router=Router(),limit=rateLimit({windowMs:60000,limit:5,keyGenerator:(_req,res)=>res.locals.scope.userId,standardHeaders:'draft-8',legacyHeaders:false});
  router.get('/',async(_req,res)=>res.json(await getPreferences(db,config,res.locals.scope)));
  router.patch('/',async(req,res)=>res.json(await updatePreferences(db,client,config,res.locals.scope,req.body)));
  router.post('/ai-key/test',limit,async(req,res)=>{const data=z.object({key:z.unknown()}).strict().parse(req.body);res.json(await testCandidateKey(db,config,res.locals.scope,data.key));});
  router.put('/ai-key',limit,async(req,res)=>res.json(await saveCandidateKey(db,client,config,res.locals.scope,req.body)));
  router.delete('/ai-key',async(req,res)=>{const {revision}=z.object({revision:z.number().int().min(0)}).strict().parse(req.body);res.json(await removeCustomKey(db,config,res.locals.scope,revision));});
  router.post('/ai-key/rotate',limit,async(req,res)=>{const {revision}=z.object({revision:z.number().int().min(0)}).strict().parse(req.body);res.json(await rotateCustomKey(db,config,res.locals.scope,revision));});
  return router;
}
