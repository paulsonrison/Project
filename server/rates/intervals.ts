import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Publication, RateInterval } from '../../shared/contracts.js';
import { resolvePrice } from '../domain/rules.js';
export interface RateChangeInput { validFrom: string; toDate?: string; price: number; preserveFollowing?: boolean; replaceOverlaps?: boolean; source?: string }
export const rateChangeSchema = z.object({ validFrom: z.iso.date(), toDate: z.iso.date().optional(), price: z.number().int().min(0).max(100000000), preserveFollowing: z.boolean().default(false), replaceOverlaps: z.boolean().default(false), source: z.string().trim().max(200).optional() }).strict();
export function inclusiveEndToExclusive(date: string): string {
  z.iso.date().parse(date);
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const value = next.toISOString().slice(0, 10);
  if (!/^\d{4}-/.test(value)) throw new Error('End date is out of range');
  return value;
}
export function legacyRateIntervals(publication: Publication): RateInterval[] {
  if (publication.pricingVersion === 2) return structuredClone(publication.rateIntervals ?? []);
  const history = [...(publication.priceHistory ?? [])].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const unique = history.filter((r, i) => {
    z.iso.date().parse(r.effectiveDate);
    if (i && history[i - 1].effectiveDate === r.effectiveDate && history[i - 1].price !== r.price) throw new Error('Conflicting legacy rate dates; review before changing prices');
    return !i || history[i - 1].effectiveDate !== r.effectiveDate;
  });
  // The undocumented base price is not evidence of the rate on earlier dates.
  return unique.map((r, i) => ({ id: `legacy:${r.effectiveDate}`, validFrom:r.effectiveDate, ...(unique[i + 1] ? { validToExclusive: unique[i + 1].effectiveDate } : {}), price:r.price, source:'Legacy effective price history' }));
}
export function validateRateIntervals(intervals: RateInterval[]): void {
  const schema = z.array(z.object({ id:z.string().min(1), validFrom:z.iso.date(), validToExclusive:z.iso.date().optional(), price:z.number().int().min(0).max(100000000), source:z.string().max(200).optional() })).max(2000);
  const ordered = schema.parse(intervals).sort((a,b) => a.validFrom.localeCompare(b.validFrom));
  const ids = new Set<string>();
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    if (ids.has(item.id)) throw new Error('Duplicate rate revision'); ids.add(item.id);
    if (item.validToExclusive && item.validToExclusive <= item.validFrom) throw new Error('Rate end must follow start');
    if (i && (!ordered[i - 1].validToExclusive || ordered[i - 1].validToExclusive! > item.validFrom)) throw new Error('Rate intervals overlap');
  }
}
export function previewRateChange(publication: Publication, raw: RateChangeInput): { publication: Publication; changed: RateInterval[]; gapsAfter?: string; migratedLegacy: boolean } {
  const input = rateChangeSchema.parse(raw), end = input.toDate ? inclusiveEndToExclusive(input.toDate) : undefined;
  if (end && end <= input.validFrom) throw new Error('Rate end must be on or after start');
  const old = legacyRateIntervals(publication); validateRateIntervals(old);
  const conflicts = old.filter(r => r.validFrom < (end ?? '9999-12-31') && (r.validToExclusive ?? '9999-12-31') > input.validFrom);
  if (!input.replaceOverlaps && conflicts.some(r => !r.id.startsWith('legacy:'))) throw new Error('Rate overlap: review and explicitly replace the conflicting scheduled rate');
  const intervals: RateInterval[] = [];
  for (const r of old) {
    if ((r.validToExclusive && r.validToExclusive <= input.validFrom) || (end && r.validFrom >= end)) { intervals.push(r); continue; }
    if (r.validFrom < input.validFrom) intervals.push({ ...r, validToExclusive:input.validFrom });
    if (end && input.preserveFollowing && (!r.validToExclusive || r.validToExclusive > end)) intervals.push({ ...r, id:randomUUID(), validFrom:end });
  }
  const added: RateInterval = { id:randomUUID(), validFrom:input.validFrom, price:input.price, ...(end ? {validToExclusive:end}:{}), ...(input.source ? {source:input.source}:{}) };
  intervals.push(added); intervals.sort((a,b)=>a.validFrom.localeCompare(b.validFrom)); validateRateIntervals(intervals);
  const next = { ...publication, pricingVersion:2 as const, rateIntervals:intervals };
  return { publication:next, changed:conflicts, ...(end && !input.preserveFollowing && !intervals.some(r=>r.validFrom<=end && (!r.validToExclusive || r.validToExclusive>end)) ? {gapsAfter:end}:{}), migratedLegacy:publication.pricingVersion!==2 };
}
export function dailyRateHistory(publication: Publication, month: string): { date: string; priceMinor: number | null; status: 'rate' | 'missing'; rateRevisionId?: string }[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
  const [year, m] = month.split('-').map(Number), length = new Date(Date.UTC(year,m,0)).getUTCDate();
  return Array.from({length}, (_,i) => {
    const date = `${month}-${String(i+1).padStart(2,'0')}`;
    try {
      const priceMinor = resolvePrice(publication,date);
      const rate = publication.rateIntervals?.find(r=>r.validFrom<=date && (!r.validToExclusive||r.validToExclusive>date));
      return {date, priceMinor, status:'rate' as const, ...(rate ? {rateRevisionId:rate.id}:{})};
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Missing rate')) throw error;
      return {date, priceMinor:null, status:'missing' as const};
    }
  });
}
