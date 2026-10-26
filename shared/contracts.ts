export type Role = 'admin' | 'resident' | 'staff';
export interface AccessScope { userId: string; societyId: string; role: Role; residentId?: string; staffId?: string }
export interface PriceRule { type: string; specificDate?: string; dayOfWeek?: number; price: number }
export interface Publication {
  schedule: string; basePrice: number; scheduleDays?: number[]; scheduleDayOfMonth?: number;
  scheduleMonth?: number; priceExceptions?: PriceRule[]; monthlyPrices?: { yearMonth: string; price: number }[];
  priceHistory?: { effectiveDate: string; price: number }[];
}
export interface DateRange { startDate: string; endDate?: string }
export interface DeliveryCharge { status: string; deliveredQuantity: number; billableQuantity: number; priceMinor: number }
