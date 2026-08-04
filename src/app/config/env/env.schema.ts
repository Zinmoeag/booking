import { z } from 'zod';

const EnvValidation = z.object({
  PORT: z.string(),
  ACCESS_TOKEN_PRIVATE_KEY: z.string(),
  ACCESS_TOKEN_PUBLIC_KEY: z.string(),
  REFRESH_TOKEN_PRIVATE_KEY: z.string(),
  REFRESH_TOKEN_PUBLIC_KEY: z.string(),
});

export type Env = z.infer<typeof EnvValidation>;

export default EnvValidation;
