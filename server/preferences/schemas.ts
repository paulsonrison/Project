import { z } from 'zod';
export const localeSchema=z.enum(['en-IN','hi-IN','ml-IN']);
export const sourceSchema=z.enum(['default','custom']);
export const keySchema=z.string().trim().min(20).max(512).regex(/^[\x21-\x7e]+$/);
export const updateSchema=z.object({revision:z.number().int().min(0),locale:localeSchema.optional(),onboardingVersion:z.number().int().min(0).max(1).optional(),aiSource:sourceSchema.optional(),aiRevision:z.number().int().min(0).optional()}).strict();
export const keySaveSchema=z.object({key:keySchema,verificationId:z.string().uuid(),revision:z.number().int().min(0)}).strict();
