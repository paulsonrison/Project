import { describe, expect, it } from 'vitest';
import { getServiceDates, resolvePrice, invoiceTotal, balance } from './rules.js';

describe('newspaper rules', () => {
  const paper = { schedule: 'daily', basePrice: 100, scheduleDays: [], priceExceptions: [], monthlyPrices: [] };
  it('handles leap years and exclusive subscription ends', () => {
    expect(getServiceDates(paper, { startDate: '2028-02-01', endDate: '2028-03-01' }, [], '2028-02')).toHaveLength(29);
    expect(getServiceDates(paper, { startDate: '2026-10-10', endDate: '2026-10-20' }, [{ startDate: '2026-10-12', endDate: '2026-10-15' }], '2026-10')).toHaveLength(7);
  });
  it('skips impossible monthly dates and merges pauses naturally', () => {
    expect(getServiceDates({ ...paper, schedule: 'monthly', scheduleDayOfMonth: 31 }, { startDate: '2027-01-01' }, [], '2027-02')).toEqual([]);
    expect(getServiceDates(paper, { startDate: '2027-02-01' }, [{ startDate: '2027-02-02', endDate: '2027-02-05' }, { startDate: '2027-02-03', endDate: '2027-02-06' }], '2027-02')).toHaveLength(24);
  });
  it('uses explicit-date prices before weekday and monthly prices', () => {
    expect(resolvePrice({ ...paper, monthlyPrices: [{ yearMonth: '2026-10', price: 120 }], priceExceptions: [{ type: 'day_of_week', dayOfWeek: 0, price: 150 }, { type: 'specific_date', specificDate: '2026-10-04', price: 200 }] }, '2026-10-04')).toBe(200);
  });
  it('charges actual copies and rejects unreconciled days', () => {
    expect(invoiceTotal([{ status: 'partial', deliveredQuantity: 2, billableQuantity: 2, priceMinor: 100 }])).toBe(200);
    expect(() => invoiceTotal([{ status: 'pending', deliveredQuantity: 0, billableQuantity: 0, priceMinor: 100 }])).toThrow('Unresolved');
  });
  it('computes partial payments and overpayments with credits', () => {
    expect(balance(1000, 400, 200)).toEqual({ due: 400, credit: 0 });
    expect(balance(1000, 1000, 200)).toEqual({ due: 0, credit: 200 });
    expect(balance(1000, 1100, 0)).toEqual({ due: 0, credit: 100 });
  });
});
