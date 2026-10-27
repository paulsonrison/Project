import type { DateRange, DeliveryCharge, Publication } from '../../shared/contracts.js';

export function getServiceDates(p: Publication, subscription: DateRange, pauses: DateRange[], month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, n) => `${month}-${String(n + 1).padStart(2, '0')}`).filter(date => {
    if (date < subscription.startDate || (subscription.endDate && date >= subscription.endDate)) return false;
    if (pauses.some(pause => date >= pause.startDate && (!pause.endDate || date < pause.endDate))) return false;
    const d = new Date(`${date}T12:00:00Z`), dow = d.getUTCDay(), day = d.getUTCDate();
    switch (p.schedule) {
      case 'daily': return true;
      case 'weekdays': return dow >= 1 && dow <= 5;
      case 'weekends': return dow === 0 || dow === 6;
      case 'sundays': return dow === 0;
      case 'specific': return p.scheduleDays?.includes(dow) ?? false;
      case 'monthly': return day === p.scheduleDayOfMonth;
      case 'annual': return m === p.scheduleMonth && day === p.scheduleDayOfMonth;
      default: return false;
    }
  });
}
export function resolvePrice(p: Publication, date: string): number {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const valid = (r: {validFrom?: string; validToExclusive?: string}) => (!r.validFrom || r.validFrom<=date) && (!r.validToExclusive || date<r.validToExclusive);
  const exact = p.priceExceptions?.find(r => r.type === 'specific_date' && r.specificDate === date && valid(r));
  const weekday = p.priceExceptions?.find(r => r.type === 'day_of_week' && r.dayOfWeek === dow && valid(r));
  const monthly = p.monthlyPrices?.find(r => r.yearMonth === date.slice(0, 7) && valid(r));
  const interval = p.rateIntervals?.find(r => valid(r));
  if (exact || weekday || monthly) return (exact ?? weekday ?? monthly)!.price;
  if (p.pricingVersion === 2) {
    if (!interval) throw new Error(`Missing rate for ${date}; enter a dated rate before preparing deliveries`);
    return interval.price;
  }
  const historical = [...(p.priceHistory ?? [])].filter(r => r.effectiveDate <= date).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return historical?.price ?? p.basePrice;
}
export function invoiceTotal(deliveries: DeliveryCharge[]): number {
  if (deliveries.some(d => d.status === 'pending')) throw new Error('Unresolved delivery dates');
  return deliveries.reduce((sum, d) => sum + d.billableQuantity * d.priceMinor, 0);
}
export function balance(total: number, paid: number, credits: number) {
  const net = total - credits - paid;
  return { due: Math.max(0, net), credit: Math.max(0, -net) };
}
