import { describe, expect, it } from 'vitest';
import { dictionaries, interpolate, normalizeLocale, translateFor } from '../src/i18n/messages';
import { formatBusinessDate, formatMoney } from '../src/i18n/format';

describe('localized owner workflows', () => {
  it('translates financial and destructive actions in both target languages', () => {
    expect(translateFor('hi-IN', 'Save record')).toBe('रिकॉर्ड सहेजें');
    expect(translateFor('ml-IN', 'Save record')).toBe('വിവരങ്ങൾ സേവ് ചെയ്യുക');
    expect(translateFor('hi-IN', 'Archive')).not.toBe('Archive');
    expect(translateFor('ml-IN', 'Rate history')).not.toBe('Rate history');
  });
  it('keeps all target language keys aligned and falls back without losing values', () => {
    expect(Object.keys(dictionaries['hi-IN']).sort()).toEqual(Object.keys(dictionaries['ml-IN']).sort());
    expect(translateFor('ml-IN', 'Unknown {name}', { name: 'B-012' })).toBe('Unknown B-012');
    expect(interpolate('{count} / {name}', { count: 0, name: 'അനു' })).toBe('0 / അനു');
    expect(normalizeLocale('ml')).toBe('ml-IN');
    expect(normalizeLocale('invalid')).toBe('en-IN');
  });
  it('formats paise and India business dates without shifting the calendar day', () => {
    expect(formatMoney(20200, 'en-IN')).toBe('₹202.00');
    expect(formatBusinessDate('2026-10-01', 'en-IN')).toBe('01 Oct 2026');
    expect(formatBusinessDate('not-a-date', 'ml-IN')).toBe('not-a-date');
  });
});
