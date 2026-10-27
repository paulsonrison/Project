import { afterAll,afterEach,beforeAll,describe,expect,it,vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import type { Config } from '../config/env.js';
import { getPreferences,updatePreferences,testCandidateKey,saveCandidateKey,removeCustomKey,resolveAiConfig,rotateCustomKey } from './service.js';
describe('integration encrypted owner preferences',()=>{
  let mongo:MongoMemoryReplSet,client:MongoClient;
  const config:Config={mongoUri:'mongodb://localhost',database:'test',origin:'http://localhost',port:3001,production:false,groqModel:'test',groqKey:'default-synthetic-key',aiKeyEncryptionKey:randomBytes(32).toString('base64')};
  const scope={societyId:'a',userId:'owner',role:'admin' as const},key='synthetic-groq-key-for-tests-only';
  beforeAll(async()=>{mongo=await MongoMemoryReplSet.create({replSet:{count:1}});client=await new MongoClient(mongo.getUri()).connect();},120000);
  afterAll(async()=>{await client?.close();await mongo?.stop();});afterEach(()=>vi.unstubAllGlobals());
  it('defaults to included AI and persists individual locale/onboarding with revision safety',async()=>{
    const db=client.db('prefs-default');expect((await getPreferences(db,config,scope)).ai.source).toBe('default');
    const saved=await updatePreferences(db,client,config,scope,{revision:0,locale:'ml-IN',onboardingVersion:1});expect(saved).toMatchObject({revision:1,locale:'ml-IN',onboardingVersion:1});
    await expect(updatePreferences(db,client,config,scope,{revision:0,locale:'hi-IN'})).rejects.toThrow('changed');
    expect((await getPreferences(db,config,{...scope,userId:'other'})).locale).toBe('en-IN');
    await expect(updatePreferences(db,client,config,{...scope,role:'resident'},{revision:1,aiSource:'custom',aiRevision:0})).rejects.toThrow('Forbidden');
  });
  it('verifies then encrypts tenant key and never exposes it in responses or provider failures',async()=>{
    const db=client.db('prefs-key');vi.stubGlobal('fetch',async()=>new Response('{}',{status:200}));
    const verified=await testCandidateKey(db,config,scope,key),saved=await saveCandidateKey(db,client,config,scope,{key,verificationId:verified.verificationId,revision:0});
    expect(saved.ai).toMatchObject({source:'custom',hasCustomKey:true});expect(JSON.stringify(saved)).not.toContain(key);
    expect(JSON.stringify(await db.collection('businessAiPreferences').findOne({_id:'a'}))).not.toContain(key);
    expect((await resolveAiConfig(db,config,scope)).groqKey).toBe(key);expect((await resolveAiConfig(db,config,{...scope,societyId:'b'})).groqKey).toBe(config.groqKey);
    vi.stubGlobal('fetch',async()=>{throw new Error(key);});await expect(testCandidateKey(db,config,scope,'invalid-key-more-than-twenty')).rejects.toThrow('could not be verified');
    expect((await resolveAiConfig(db,config,scope)).groqKey).toBe(key);
    await expect(saveCandidateKey(db,client,config,{...scope,societyId:'b'},{key,verificationId:verified.verificationId,revision:0})).rejects.toThrow('again');
    await expect(resolveAiConfig(db,{...config,aiKeyEncryptionKey:undefined},scope)).rejects.toThrow('unavailable');
    expect((await removeCustomKey(db,config,scope,saved.ai.revision)).ai).toMatchObject({source:'default',hasCustomKey:false});
  });
  it('keeps default operational without encryption and supports explicit custom-key rotation',async()=>{
    const db=client.db('prefs-rotation');expect((await resolveAiConfig(db,{...config,aiKeyEncryptionKey:undefined},scope)).groqKey).toBe(config.groqKey);
    await expect(testCandidateKey(db,{...config,aiKeyEncryptionKey:undefined},scope,key)).rejects.toThrow('not available');
    vi.stubGlobal('fetch',async()=>new Response('{}'));const checked=await testCandidateKey(db,config,scope,key);const saved=await saveCandidateKey(db,client,config,scope,{key,verificationId:checked.verificationId,revision:0});
    const included=await updatePreferences(db,client,config,scope,{revision:saved.revision,aiSource:'default',aiRevision:saved.ai.revision});
    const next={...config,aiKeyEncryptionKey:randomBytes(32).toString('base64'),aiKeyEncryptionPreviousKey:config.aiKeyEncryptionKey};
    const rotated=await rotateCustomKey(db,next,scope,included.ai.revision);expect((await resolveAiConfig(db,next,scope)).groqKey).toBe(config.groqKey);
    await updatePreferences(db,client,next,scope,{revision:rotated.revision,aiSource:'custom',aiRevision:rotated.ai.revision});
    expect((await resolveAiConfig(db,{...next,aiKeyEncryptionPreviousKey:undefined},scope)).groqKey).toBe(key);
  });
});
