import { createHash,randomUUID } from 'node:crypto';
import type { Db,MongoClient,Document } from 'mongodb';
import type { Config } from '../config/env.js';
import type { AccessScope } from '../../shared/contracts.js';
import { ApiError,requireRole } from '../auth/scope.js';
import { openKey,sealKey,type KeyEnvelope } from './crypto.js';
import { keySchema,keySaveSchema,updateSchema } from './schemas.js';
interface UserPreference extends Document {_id:string;revision:number;locale?:'en-IN'|'hi-IN'|'ml-IN';onboardingVersion:number}
interface AiPreference extends Document {_id:string;revision:number;source:'default'|'custom';envelope?:KeyEnvelope}
const userId=(scope:AccessScope)=>`${scope.societyId}:${scope.userId}`;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
async function ensure(db:Db,scope:AccessScope){
  // Header, onboarding and Settings can initialize simultaneously on a new account.
  // A competing insert of the identical _id is an initialization success, not a lost preference.
  try{await db.collection<UserPreference>('userPreferences').updateOne({_id:userId(scope)},{$setOnInsert:{revision:0,onboardingVersion:0}},{upsert:true});}catch(error){if(!(typeof error==='object'&&error&&'code'in error&&error.code===11000))throw error;}
  try{await db.collection<AiPreference>('businessAiPreferences').updateOne({_id:scope.societyId},{$setOnInsert:{revision:0,source:'default'}},{upsert:true});}catch(error){if(!(typeof error==='object'&&error&&'code'in error&&error.code===11000))throw error;}
}
export async function getPreferences(db:Db,config:Config,scope:AccessScope){
  await ensure(db,scope);
  const user=(await db.collection<UserPreference>('userPreferences').findOne({_id:userId(scope)}))!;
  const ai=(await db.collection<AiPreference>('businessAiPreferences').findOne({_id:scope.societyId}))!;
  return {revision:user.revision,locale:user.locale??'en-IN',localeSaved:Boolean(user.locale),onboardingVersion:user.onboardingVersion,ai:{revision:ai.revision,source:ai.source,provider:'groq' as const,hasCustomKey:Boolean(ai.envelope),customKeysAvailable:Boolean(config.aiKeyEncryptionKey)}};
}
export async function updatePreferences(db:Db,client:MongoClient,config:Config,scope:AccessScope,raw:unknown){
  const input=updateSchema.parse(raw);if(input.aiSource!==undefined)requireRole(scope,'admin');await ensure(db,scope);
  const session=client.startSession();
  try{await session.withTransaction(async()=>{
    if(input.aiSource!==undefined){
      const ai=await db.collection<AiPreference>('businessAiPreferences').findOne({_id:scope.societyId},{session});
      if(input.aiRevision!==ai?.revision)throw new ApiError(409,'AI settings changed. Refresh and try again.');
      if(input.aiSource==='custom'&&!ai?.envelope)throw new ApiError(400,'Save and verify your Groq key first.');
      if(input.aiSource==='custom'&&!config.aiKeyEncryptionKey)throw new ApiError(503,'Personal API keys are not available yet. Use included AI.');
      await db.collection<AiPreference>('businessAiPreferences').updateOne({_id:scope.societyId,revision:input.aiRevision},{$set:{source:input.aiSource},$inc:{revision:1}},{session});
    }
    const set:Record<string,unknown>={};if(input.locale)set.locale=input.locale;if(input.onboardingVersion!==undefined)set.onboardingVersion=input.onboardingVersion;
    const result=await db.collection<UserPreference>('userPreferences').updateOne({_id:userId(scope),revision:input.revision},{$set:set,$inc:{revision:1}},{session});
    if(!result.matchedCount)throw new ApiError(409,'Settings changed. Refresh and try again.');
  });}finally{await session.endSession();}
  return getPreferences(db,config,scope);
}
export async function testCandidateKey(db:Db,config:Config,scope:AccessScope,raw:unknown){
  requireRole(scope,'admin');const key=keySchema.parse(raw);
  if(!config.aiKeyEncryptionKey)throw new ApiError(503,'Personal API keys are not available yet. Use included AI.');
  try{
    const response=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('provider rejected candidate');
  }catch{throw new ApiError(400,'This key could not be verified.');}
  const id=randomUUID();await db.collection('aiKeyVerifications').insertOne({id,societyId:scope.societyId,userId:scope.userId,keyDigest:digest(key),expiresAt:new Date(Date.now()+10*60000)});
  return {valid:true,verificationId:id};
}
export async function saveCandidateKey(db:Db,client:MongoClient,config:Config,scope:AccessScope,raw:unknown){
  requireRole(scope,'admin');const input=keySaveSchema.parse(raw);
  if(!config.aiKeyEncryptionKey)throw new ApiError(503,'Personal API keys are not available yet. Use included AI.');
  await ensure(db,scope);const envelope=sealKey(input.key,config.aiKeyEncryptionKey,scope.societyId),session=client.startSession();
  try{await session.withTransaction(async()=>{
    const verified=await db.collection('aiKeyVerifications').findOne({id:input.verificationId,societyId:scope.societyId,userId:scope.userId,keyDigest:digest(input.key),expiresAt:{$gt:new Date()}},{session});
    if(!verified)throw new ApiError(400,'Test this key again before saving.');
    const result=await db.collection<AiPreference>('businessAiPreferences').updateOne({_id:scope.societyId,revision:input.revision},{$set:{source:'custom',envelope},$inc:{revision:1}},{session});
    if(!result.matchedCount)throw new ApiError(409,'AI settings changed. Refresh and try again.');
    await db.collection('aiKeyVerifications').deleteOne({_id:verified._id},{session});
  });}finally{await session.endSession();}
  return getPreferences(db,config,scope);
}
export async function removeCustomKey(db:Db,config:Config,scope:AccessScope,revision:number){
  requireRole(scope,'admin');await ensure(db,scope);
  const result=await db.collection<AiPreference>('businessAiPreferences').updateOne({_id:scope.societyId,revision},{$set:{source:'default'},$unset:{envelope:''},$inc:{revision:1}});
  if(!result.matchedCount)throw new ApiError(409,'AI settings changed. Refresh and try again.');
  return getPreferences(db,config,scope);
}
export async function resolveAiConfig(db:Db,config:Config,scope:AccessScope):Promise<Config>{
  const ai=await db.collection<AiPreference>('businessAiPreferences').findOne({_id:scope.societyId});
  if(!ai||ai.source==='default')return config;
  if(!ai.envelope||!config.aiKeyEncryptionKey)throw new ApiError(503,'Your saved API key is unavailable. Check AI settings.');
  try{return {...config,groqKey:openKey(ai.envelope,[config.aiKeyEncryptionKey,...(config.aiKeyEncryptionPreviousKey?[config.aiKeyEncryptionPreviousKey]:[])],scope.societyId)};}
  catch{throw new ApiError(503,'Your saved API key is unavailable. Check AI settings.');}
}
export async function rotateCustomKey(db:Db,config:Config,scope:AccessScope,revision:number){
  requireRole(scope,'admin');if(!config.aiKeyEncryptionKey)throw new ApiError(503,'Key encryption is unavailable.');
  const stored=await db.collection<AiPreference>('businessAiPreferences').findOne({_id:scope.societyId,revision});if(!stored?.envelope)throw new ApiError(400,'No custom API key is saved.');
  let key:string;try{key=openKey(stored.envelope,[config.aiKeyEncryptionKey,...(config.aiKeyEncryptionPreviousKey?[config.aiKeyEncryptionPreviousKey]:[])],scope.societyId);}catch{throw new ApiError(503,'Your saved API key is unavailable. Check AI settings.');}
  const result=await db.collection<AiPreference>('businessAiPreferences').updateOne({_id:scope.societyId,revision,envelope:{$exists:true}},{$set:{envelope:sealKey(key,config.aiKeyEncryptionKey,scope.societyId)},$inc:{revision:1}});
  if(!result.matchedCount)throw new ApiError(409,'AI settings changed. Refresh and try again.');
  return getPreferences(db,config,scope);
}
