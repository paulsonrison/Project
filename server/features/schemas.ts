import { z } from 'zod';
const text = z.string().trim().max(200);
const id = z.string().uuid();
export const date = z.iso.date();
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const minor = z.number().int().min(0).max(100000000);
const range = { startDate: date, endDate: date.optional() };
export const schemas = {
  residents: z.object({ name: text.min(1), unit: text.min(1), phone: text.default(''), address: text.default(''), instructions: text.default('') }),
  staff: z.object({ name: text.min(1), phone: text.default(''), area: text.default('') }),
  publications: z.object({ name: text.min(1), basePrice: minor, schedule: z.enum(['daily', 'weekdays', 'weekends', 'sundays', 'specific', 'monthly', 'annual']), scheduleDays: z.array(z.number().int().min(0).max(6)).max(7).default([]), scheduleDayOfMonth: z.number().int().min(1).max(31).default(1), scheduleMonth: z.number().int().min(1).max(12).default(1), priceExceptions: z.array(z.object({ type: z.enum(['specific_date', 'day_of_week']), specificDate: date.optional(), dayOfWeek: z.number().int().min(0).max(6).optional(), price: minor })).max(100).default([]), monthlyPrices: z.array(z.object({ yearMonth: month, price: minor })).max(120).default([]), priceHistory: z.array(z.object({ effectiveDate: date, price: minor })).max(120).default([]) }),
  subscriptions: z.object({ residentId: id, publicationId: id, staffId: id, quantity: z.number().int().min(1).max(100).default(1), routeOrder: z.number().int().min(0).max(10000).default(0), ...range }),
  pauses: z.object({ residentId: id, subscriptionId: id.optional(), startDate: date, endDate: date, reason: text.default('Holiday') }),
  complaints: z.object({ residentId: id, deliveryId: id, reason: text.min(1) }),
};
export type Resource = keyof typeof schemas;
export function validRange(value: { startDate: string; endDate?: string }) {
  if (value.endDate && value.endDate <= value.startDate) throw new Error('End date must follow start date');
}
