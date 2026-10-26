export interface Row { id: string; revision: number; name?: string; unit?: string; phone?: string; address?: string; area?: string; instructions?: string; residentId?: string; staffId?: string; publicationId?: string; startDate?: string; endDate?: string; quantity?: number; routeOrder?: number; basePrice?: number; schedule?: string; status?: string; date?: string; orderedQuantity?: number; deliveredQuantity?: number; residentName?: string; publicationName?: string; month?: string; totalMinor?: number; dueMinor?: number; creditMinor?: number; paidMinor?: number; amountMinor?: number; reference?: string; invoiceId?: string; reversalOf?: string; lines?: { date: string; publicationName: string; quantity: number; priceMinor: number; amountMinor: number }[] }
export interface Session { userId: string; societyId: string; role: 'admin' | 'resident' | 'staff'; name: string; email: string; residentId?: string; staffId?: string; society: { name: string; currency: string; timezone: string } }
export interface PublicationRow extends Row { priceExceptions?: { type: string; dayOfWeek?: number; specificDate?: string; price: number }[]; monthlyPrices?: { yearMonth: string; price: number }[]; priceHistory?: { effectiveDate: string; price: number }[]; scheduleDays?: number[] }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({ error: { message: 'The server is unavailable. Please retry.' } }));
  if (!response.ok) throw new Error(data.error?.message ?? 'Unable to complete request');
  return data;
}
export function save<T>(path: string, body: unknown, method = 'POST', key?: string) { return api<T>(path, { method, body: JSON.stringify(body), headers: key ? { 'Idempotency-Key': key } : undefined }); }
export const money = (minor = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);
