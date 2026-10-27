import { z } from 'zod';
const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  MONGODB_DATABASE: z.string().default('presstrack'),
  APP_ORIGIN: z.url(), PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GROQ_API_KEY: z.string().optional(), GROQ_MODEL: z.string().default('qwen/qwen3.8-27b'),
  AI_KEY_ENCRYPTION_KEY:z.string().refine(v=>Buffer.from(v,'base64').length===32&&Buffer.from(v,'base64').toString('base64')===v,'Use a base64-encoded 32-byte encryption key').optional(),
  AI_KEY_ENCRYPTION_PREVIOUS_KEY:z.string().refine(v=>Buffer.from(v,'base64').length===32&&Buffer.from(v,'base64').toString('base64')===v,'Use a base64-encoded 32-byte encryption key').optional(),
  OCR_ENABLED:z.enum(['true','false']).default('false'),OCR_DATA_PATH:z.string().optional(),
});
export function readEnv(input: Record<string, string | undefined>) {
  const value = schema.parse({ ...input, APP_ORIGIN: input.APP_ORIGIN || input.RENDER_EXTERNAL_URL,AI_KEY_ENCRYPTION_KEY:input.AI_KEY_ENCRYPTION_KEY||undefined,AI_KEY_ENCRYPTION_PREVIOUS_KEY:input.AI_KEY_ENCRYPTION_PREVIOUS_KEY||undefined });
  return { mongoUri: value.MONGODB_URI, database: value.MONGODB_DATABASE, origin: value.APP_ORIGIN, port: value.PORT, production: value.NODE_ENV === 'production', groqKey: value.GROQ_API_KEY, groqModel: value.GROQ_MODEL,...(value.AI_KEY_ENCRYPTION_KEY?{aiKeyEncryptionKey:value.AI_KEY_ENCRYPTION_KEY}:{}),...(value.AI_KEY_ENCRYPTION_PREVIOUS_KEY?{aiKeyEncryptionPreviousKey:value.AI_KEY_ENCRYPTION_PREVIOUS_KEY}:{}),...(value.OCR_ENABLED==='true'?{ocrEnabled:true}:{}),...(value.OCR_DATA_PATH?{ocrDataPath:value.OCR_DATA_PATH}:{}) };
}
export type Config = ReturnType<typeof readEnv>;
