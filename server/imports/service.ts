import { randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import { z } from 'zod';
import type { AccessScope, Publication } from '../../shared/contracts.js';
import { ApiError, requireRole } from '../auth/scope.js';
import { schemas } from '../features/schemas.js';
import { previewRateChange } from '../rates/intervals.js';
import { paperCode, type ImportEntity, type ImportMode, type ImportRecord } from './workbook.js';
export interface Input { entity: ImportEntity; mode: ImportMode; rows: Record<string,string>[]; templateId?: string; effectiveDate?: string; mapping?: Record<string,string> }
interface Change { collection: string; id: string; revision?: number; action: 'create' | 'update' | 'archive'; data: Record<string,unknown>; label: string }
export interface Preview { id: string; changes: Change[]; errors: { row: number; message: string }[]; expiresAt: Date; entity: ImportEntity; mode: ImportMode }
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const inputSchema = z.object({ entity: z.enum(['residents','publications']), mode: z.enum(['add','update','remove','replace']), rows: z.array(z.record(z.string(), z.string().max(2000))).max(5000), templateId: z.string().optional(), effectiveDate: z.iso.date().optional(), mapping: z.record(z.string(),z.string()).optional() });
const versions = (records: Record<string,unknown>[]) => records.map(r=>[String(r.id),Number(r.revision)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
async function protectsHistory(db:Db,societyId:string,collection:string,id:string,from:string,session?:import('mongodb').ClientSession) {
  return db.collection('deliveries').findOne({societyId,[collection==='residents'?'residentId':collection==='publications'?'publicationId':'subscriptionId']:id,date:{$gte:from},$or:[{invoiceId:{$exists:true}},{status:{$in:['delivered','partial']}}]},{session});
}
export async function createPreview(db: Db, scope: AccessScope, raw: Input): Promise<Preview> {
  requireRole(scope, 'admin'); const input = inputSchema.parse(raw), { entity, mode } = input;
  const records = await db.collection(entity).find({ societyId: scope.societyId, archived: { $ne: true } }).toArray();
  const papers = await db.collection<ImportRecord>('publications').find({ societyId: scope.societyId, archived: { $ne: true } }).toArray();
  const template = input.templateId ? await db.collection('importTemplates').findOne({ id: input.templateId, societyId: scope.societyId, userId: scope.userId, expiresAt: { $gt: new Date() } }) : null;
  if (input.templateId && !template) throw new ApiError(409, 'This template expired or belongs to another account. Download a fresh workbook.');
  if (template && (template.entity !== entity || template.mode !== mode)) throw new ApiError(400, 'Choose the same data and mode used to download this workbook');
  if (mode === 'replace' && !template) throw new ApiError(400, 'Replacement requires a fresh downloaded snapshot');
  const preview: Preview = { id: randomUUID(), changes: [], errors: [], expiresAt: new Date(Date.now() + 30 * 60000), entity, mode };
  const ids = new Set<string>(), newKeys = new Set<string>();
  const references = await db.collection('subscriptions').find({ societyId: scope.societyId, archived: { $ne: true } }).toArray();
  const touchedSubs = new Map<string, number>();
  for (const [index, original] of input.rows.entries()) {
    const checkpoint = preview.changes.length;
    try {
      const row: Record<string,string> = Object.create(null); for (const [key,value] of Object.entries(original)) {const mapped=input.mapping?.[key]||key;if(Object.hasOwn(row,mapped))throw new Error('Two columns map to the same field. Use a unique mapping.');row[mapped]=value.trim();}
      const id = row[entity === 'residents' ? 'Customer ID' : 'Newspaper ID'] || '';
      if (id && ids.has(id)) throw new Error('Duplicate ID in this workbook'); if(id) ids.add(id);
      const existing = records.find(r => r.id === id);
      if (mode === 'add' && id) throw new Error('Add new does not update existing IDs');
      if (mode !== 'add' && !existing) throw new Error('Unknown ID. Use Add new to create a record');
      if (existing && (String(existing.revision) !== row.Revision || (template && !template.revisions.some((v: {id:string;revision:number}) => v.id === id && v.revision === existing.revision)))) throw new Error('Record changed since download. Refresh the workbook');
      if (mode === 'remove' || row['Remove?']?.toLowerCase() === 'yes') {
        if (row['Remove?']?.toLowerCase() === 'yes' && existing) {
          const archiveDate=input.effectiveDate||today();
          if(await protectsHistory(db,scope.societyId,entity,id,archiveDate)) throw new Error('Removal date would remove recorded delivery history. Choose a later date.');
          preview.changes.push({ collection: entity, id, revision: existing.revision, action: 'archive', data: { archived: true, archivedDate: archiveDate }, label: String(existing.name) });
        }
        continue;
      }
      const data: Record<string,unknown> = {};
      const fields = entity === 'residents' ? { Name: 'name', Number: 'phone', 'Address/Flat': 'unit', Address: 'address' } : { Name: 'name', Code: 'code', 'Edition/City': 'edition', Schedule: 'schedule' };
      for (const [header, field] of Object.entries(fields)) if (row[header]) data[field] = row[header];
      if (!existing) {
        if (!data.name) throw new Error('Name is required');
        const duplicate = entity === 'residents' ? `${data.name}|${data.unit}`.toLowerCase() : String(data.code || data.name).toLowerCase();
        if (newKeys.has(duplicate) || records.some(r => entity === 'residents' ? `${r.name}|${r.unit}`.toLowerCase() === duplicate : String(r.code || r.name).toLowerCase() === duplicate)) throw new Error('Possible duplicate: review the existing record instead');
        newKeys.add(duplicate);
      }
      if (entity === 'publications') {
        if (data.code && !/^[A-Za-z0-9_-]{1,16}$/.test(String(data.code))) throw new Error('Code must be 1–16 letters, numbers, underscores or hyphens');
        if (data.code) data.code = String(data.code).toUpperCase();
        if (data.code && papers.some(p => p.id !== id && paperCode(p) === data.code)) throw new Error('This newspaper code already exists');
        if (!existing && (!row['Amount (INR)'] || !row['From Date'])) throw new Error('Amount and From Date are required for a new newspaper');
        if (row['Amount (INR)']) {
          if (!/^\d+(\.\d{1,2})?$/.test(row['Amount (INR)'])) throw new Error('Enter a nonnegative price with at most two decimal places');
          const price = Math.round(Number(row['Amount (INR)']) * 100); z.number().int().min(0).max(100000000).parse(price);
          const from = z.iso.date().parse(row['From Date']);
          const base = { ...existing, ...data, basePrice: existing?.basePrice ?? price, schedule: data.schedule || existing?.schedule || 'daily' } as unknown as Publication;
          const planned = previewRateChange(base, { validFrom: from, toDate: row['To Date (optional)'] || undefined, price, replaceOverlaps: true });
          Object.assign(data, { rateIntervals: planned.publication.rateIntervals, pricingVersion: 2, basePrice: existing?.basePrice ?? price });
        }
        if (!existing) data.schedule ||= 'daily';
      }
      const normalized = schemas[entity].parse({ ...existing, ...data });
      const recordId = existing?.id || randomUUID();
      preview.changes.push({ collection: entity, id: recordId, revision: existing?.revision, action: existing ? 'update' : 'create', data: normalized, label: String(normalized.name) });
      if (entity === 'residents') {
        const desired = new Map<string, number>();
        for (const [header, value] of Object.entries(row)) if (header.startsWith('Subscription: ')) {
          if (!value && mode !== 'replace') continue;
          const paper = papers.find(p => paperCode(p) === header.slice(14).trim());
          if (!paper) throw new Error(`Unknown newspaper code: ${header.slice(14)}`);
          const quantity = value === '' ? 0 : Number(value); z.number().int().min(0).max(100).parse(quantity); desired.set(paper.id, quantity);
        }
        if (mode === 'replace') papers.forEach(p => { if (!desired.has(p.id)) desired.set(p.id,0); });
        const effective = row['Start Date'] || input.effectiveDate;
        for (const [publicationId,quantity] of desired) {
          const comparisonDate=effective || today();
          const active = references.filter(s => s.residentId === recordId && s.publicationId === publicationId && s.startDate <= comparisonDate && (!s.endDate || s.endDate > comparisonDate));
          if (active.length > 1) throw new Error('Multiple matching subscriptions; resolve them before upload');
          if (active[0]?.quantity === quantity || (!active.length && quantity === 0)) continue;
          if (!effective) throw new Error('Start Date is required when changing newspaper quantities'); z.iso.date().parse(effective);
          const old = active[0];
          if (old) {
            if (effective <= old.startDate) throw new Error('Use a change date after the existing subscription start');
            if (await db.collection('deliveries').findOne({ societyId: scope.societyId, subscriptionId: old.id, date: { $gte: effective }, $or: [{ invoiceId: {$exists:true}}, {status:{$in:['delivered','partial']}}] })) throw new Error('Change date would remove recorded delivery history');
            preview.changes.push({ collection: 'subscriptions', id: old.id, revision: old.revision, action: 'update', data: { endDate: effective }, label: String(papers.find(p=>p.id===old.publicationId)?.name || 'Subscription') }); touchedSubs.set(old.id, old.revision);
          }
          if (quantity) {
            if (references.some(s => s.residentId === recordId && s.publicationId === publicationId && s.id !== old?.id && (!s.endDate || s.endDate > effective))) throw new Error('A future subscription overlaps this change');
            preview.changes.push({ collection:'subscriptions', id:randomUUID(), action:'create', data:{residentId:recordId,publicationId,quantity,startDate:effective,routeOrder:old?.routeOrder || 0}, label:`${normalized.name}: ${quantity} copies` });
          }
        }
      }
    } catch (error) { preview.changes.length = checkpoint; preview.errors.push({ row: index+2, message: error instanceof Error ? error.message : 'Invalid row' }); }
  }
  if (mode === 'replace' && (!input.rows.length || template?.revisions.some((r: {id:string}) => !ids.has(r.id)))) preview.errors.push({row:0,message:'Replacement must contain every exported ID. Mark Remove? Yes explicitly; do not delete rows.'});
  const dependencies:Record<string,(string|number)[][]>={[entity]:versions(records),publications:versions(papers),subscriptions:versions(references)};
  // All import transactions for this tenant write one guard, making simultaneous commits
  // retry against fresh snapshots before duplicate and subscription checks.
  await db.collection<{_id:string;revision:number}>('importGuards').updateOne({_id:scope.societyId},{$setOnInsert:{revision:0}},{upsert:true});
  await db.collection('importBatches').insertOne({ ...preview, societyId:scope.societyId, userId:scope.userId, dependencies, subscriptionVersions: [...touchedSubs], createdAt:new Date() });
  return preview;
}
export async function commitPreview(db: Db, client: MongoClient, scope: AccessScope, id: string) {
  requireRole(scope,'admin'); const session = client.startSession(); let output: {batchId:string;changed:number} | undefined;
  try { await session.withTransaction(async () => {
    const batch = await db.collection('importBatches').findOne({id,societyId:scope.societyId,userId:scope.userId},{session});
    if (!batch) throw new ApiError(404,'Import preview not found');
    if (batch.result) { output=batch.result; return; }
    if (batch.expiresAt < new Date() || batch.errors.length) throw new ApiError(409,'Preview expired or has errors. Review a fresh upload');
    await db.collection<{_id:string;revision:number}>('importGuards').updateOne({_id:scope.societyId},{$inc:{revision:1}},{session});
    for(const [collection,expected] of Object.entries(batch.dependencies??{})) {
      const current=await db.collection(collection).find({societyId:scope.societyId,archived:{$ne:true}},{session,projection:{id:1,revision:1}}).toArray();
      if(JSON.stringify(versions(current))!==JSON.stringify(expected))throw new ApiError(409,'Records or subscriptions changed since preview. Upload again.');
    }
    const changes=batch.changes as Change[];
    for(const change of changes) {
      const collection=db.collection(change.collection);
      if((change.action==='archive'||(change.collection==='subscriptions'&&change.data.endDate))&&await protectsHistory(db,scope.societyId,change.collection,change.id,String(change.data.archivedDate||change.data.endDate),session))throw new ApiError(409,'Delivery history changed since preview. Choose a later change date.');
      if(change.action==='create') await collection.insertOne({...change.data,id:change.id,societyId:scope.societyId,revision:0,createdAt:new Date().toISOString()},{session});
      else {
        const result=await collection.updateOne({id:change.id,societyId:scope.societyId,revision:change.revision,archived:{$ne:true}},{$set:change.data,$inc:{revision:1}},{session});
        if(result.matchedCount!==1) throw new ApiError(409,'A record changed since preview. Upload again');
      }
    }
    output={batchId:id,changed:changes.length};
    await db.collection('importBatches').updateOne({id,societyId:scope.societyId},{$set:{result:output,committedAt:new Date()}},{session});
    await db.collection('auditEvents').insertOne({id:randomUUID(),societyId:scope.societyId,userId:scope.userId,type:'import.commit',batchId:id,changes:changes.map(({data,...c})=>{void data;return c;}),createdAt:new Date()},{session});
  }); return output!; } finally { await session.endSession(); }
}
export async function templateContext(db:Db,scope:AccessScope,entity:ImportEntity,mode:ImportMode,locale:string,selection?:string[]) {
  requireRole(scope,'admin');
  const records=await db.collection<ImportRecord>(entity).find({societyId:scope.societyId,archived:{$ne:true},...(selection?.length?{id:{$in:selection}}:{})},{projection:{_id:0}}).limit(5001).toArray();
  if(records.length>5000) throw new ApiError(400,'Choose a smaller selection (maximum 5,000 records)');
  const publications=await db.collection<ImportRecord>('publications').find({societyId:scope.societyId,archived:{$ne:true}},{projection:{_id:0}}).limit(181).toArray();
  if(publications.length>180)throw new ApiError(400,'This workbook supports at most 180 newspaper columns. Reduce the active catalog before using Excel imports.');
  const subscriptions=await db.collection('subscriptions').find({societyId:scope.societyId,archived:{$ne:true},startDate:{$lte:today()},$or:[{endDate:{$exists:false}},{endDate:{$gt:today()}}]}).toArray();
  const id=randomUUID(); await db.collection('importTemplates').insertOne({id,societyId:scope.societyId,userId:scope.userId,entity,mode,revisions:records.map(r=>({id:r.id,revision:r.revision})),expiresAt:new Date(Date.now()+7*86400000)});
  return {id,entity,mode,locale,records,publications,subscriptions:subscriptions.map(s=>({residentId:String(s.residentId),publicationId:String(s.publicationId),quantity:Number(s.quantity)}))};
}

