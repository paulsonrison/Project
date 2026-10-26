import { z } from 'zod';
const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  MONGODB_DATABASE: z.string().default('presstrack'),
  APP_ORIGIN: z.url(), PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GROQ_API_KEY: z.string().optional(), GROQ_MODEL: z.string().default('qwen/qwen3.8-27b'),
});
export function readEnv(input: Record<string, string | undefined>) {
  const value = schema.parse(input);
  return { mongoUri: value.MONGODB_URI, database: value.MONGODB_DATABASE, origin: value.APP_ORIGIN, port: value.PORT, production: value.NODE_ENV === 'production', groqKey: value.GROQ_API_KEY, groqModel: value.GROQ_MODEL };
}
export type Config = ReturnType<typeof readEnv>;
