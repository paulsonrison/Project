import { describe, expect, it } from 'vitest';
import { previewRateChange, dailyRateHistory, inclusiveEndToExclusive } from './intervals.js';
import { resolvePrice } from '../domain/rules.js';
import type { Publication } from '../../shared/contracts.js';

describe('bounded newspaper rates', () => {
  const paper: Publication = { schedule: 'daily', basePrice: 600, priceHistory: [{ effectiveDate: '2026-10-01', price: 600 }] };
  it('converts inclusive ends using calendar dates, including leap days', () => {
    expect(inclusiveEndToExclusive('2028-02-29')).toBe('2028-03-01');
    expect(() => inclusiveEndToExclusive('2027-02-29')).toThrow('date');
  });
  it('splits an existing base interval from a new open start', () => {
    const result = previewRateChange(paper, { validFrom: '2026-10-16', price: 700 });
    expect(resolvePrice(result.publication, '2026-10-15')).toBe(600);
    expect(resolvePrice(result.publication, '2026-10-16')).toBe(700);
    expect(dailyRateHistory(result.publication, '2026-10').reduce((s, d) => s + d.priceMinor!, 0)).toBe(20200);
    expect(dailyRateHistory(result.publication, '2026-10').filter(d => !['2026-10-20','2026-10-21','2026-10-22'].includes(d.date)).reduce((s, d) => s + d.priceMinor!, 0)).toBe(18100);
  });
  it('does not infer undocumented earlier historical rates', () => {
    const result = previewRateChange(paper, { validFrom: '2026-10-16', price: 700 });
    expect(() => resolvePrice(result.publication, '2026-09-30')).toThrow('Missing rate');
  });
  it('does not resume a prior rate unless preservation was explicit', () => {
    const result = previewRateChange(paper, { validFrom: '2026-10-16', toDate: '2026-10-20', price: 700 });
    expect(resolvePrice(result.publication, '2026-10-20')).toBe(700);
    expect(() => resolvePrice(result.publication, '2026-10-21')).toThrow('Missing rate');
    const preserved = previewRateChange(paper, { validFrom: '2026-10-16', toDate: '2026-10-20', price: 700, preserveFollowing: true });
    expect(resolvePrice(preserved.publication, '2026-10-21')).toBe(600);
  });
  it('retains exact/weekday/monthly precedence inside validity boundaries', () => {
    const p = previewRateChange({ ...paper, monthlyPrices: [{ yearMonth:'2026-10', price: 800 }], priceExceptions: [{ type: 'day_of_week', dayOfWeek: 0, price: 900, validFrom:'2026-10-01', validToExclusive:'2026-10-05' }, { type:'specific_date', specificDate:'2026-10-04', price:1000 }] }, { validFrom:'2026-10-16', price:700 }).publication;
    expect(resolvePrice(p, '2026-10-04')).toBe(1000);
    expect(resolvePrice(p, '2026-10-11')).toBe(800);
  });
  it('requires confirmation to replace a scheduled overlapping rate', () => {
    const p = previewRateChange(paper, { validFrom: '2026-10-16', price:700 }).publication;
    expect(() => previewRateChange(p, { validFrom:'2026-10-20', price:800 })).toThrow('overlap');
    expect(resolvePrice(previewRateChange(p, { validFrom:'2026-10-20', price:800, replaceOverlaps:true }).publication, '2026-10-20')).toBe(800);
  });
  it('exposes missing days as gaps and returns exactly 29 leap-February dates', () => {
    const p = previewRateChange(paper, { validFrom:'2028-02-01', toDate:'2028-02-10', price:700 }).publication;
    const days = dailyRateHistory(p, '2028-02');
    expect(days).toHaveLength(29);
    expect(days[10]).toMatchObject({ date:'2028-02-11', priceMinor:null, status:'missing' });
  });
  it('rejects invalid ranges, amounts and conflicting legacy dates', () => {
    expect(() => previewRateChange(paper, { validFrom:'2026-10-16', toDate:'2026-10-15', price:700 })).toThrow();
    expect(() => previewRateChange(paper, { validFrom:'2026-10-16', price:7.5 })).toThrow();
    expect(() => previewRateChange({ ...paper, priceHistory:[{effectiveDate:'2026-10-01',price:600},{effectiveDate:'2026-10-01',price:700}] }, { validFrom:'2026-10-16',price:800 })).toThrow('Conflicting');
  });
});
