import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BROKER_URLS: z.string().min(1), // Comma separated list of broker URLs
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const validate = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Config validation error: ${result.error.toString()}`);
  }
  return result.data;
};
