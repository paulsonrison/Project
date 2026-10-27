import type { Locale } from './messages';

export const formatMoney = (minor: number, locale: Locale = 'en-IN') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR', numberingSystem: 'latn' }).format(minor / 100);

export function formatBusinessDate(value: string, locale: Locale = 'en-IN'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata', numberingSystem: 'latn' }).format(date);
}
