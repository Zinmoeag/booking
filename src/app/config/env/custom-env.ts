import { AppError, errorKinds } from '@/app/error';

import EnvValidation, { Env } from './env.schema';

export const getEnvVariable = (): Env => {
  const raw = {
    PORT: process.env.PORT ?? 4000,
    ACCESS_TOKEN_PRIVATE_KEY: process.env.ACCESS_TOKEN_PRIVATE_KEY,
    ACCESS_TOKEN_PUBLIC_KEY: process.env.ACCESS_TOKEN_PUBLIC_KEY,
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? '15m',
    REFRESH_TOKEN_PRIVATE_KEY: process.env.REFRESH_TOKEN_PRIVATE_KEY,
    REFRESH_TOKEN_PUBLIC_KEY: process.env.REFRESH_TOKEN_PUBLIC_KEY,
  };

  const validatation = EnvValidation.safeParse(raw);
  if (!validatation.success) {
    throw AppError.new(errorKinds.internalServerError, 'failed to pass');
  }

  return validatation.data;
};
