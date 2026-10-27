export type Role = 'admin' | 'resident' | 'staff';
export interface AccessScope { userId: string; societyId: string; role: Role; residentId?: string; staffId?: string }
export interface RateInterval { id: string; validFrom: string; validToExclusive?: string; price: number; source?: string }
export interface PriceRule { type: string; specificDate?: string; dayOfWeek?: number; price: number; validFrom?: string; validToExclusive?: string }
export interface Publication {
  schedule: string; basePrice: number; scheduleDays?: number[]; scheduleDayOfMonth?: number;
  scheduleMonth?: number; priceExceptions?: PriceRule[]; monthlyPrices?: { yearMonth: string; price: number; validFrom?: string; validToExclusive?: string }[];
  priceHistory?: { effectiveDate: string; price: number }[];
  pricingVersion?: 2; rateIntervals?: RateInterval[];
}
export interface DateRange { startDate: string; endDate?: string }
export interface DeliveryCharge { status: string; deliveredQuantity: number; billableQuantity: number; priceMinor: number }
