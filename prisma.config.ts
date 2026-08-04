import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { env } from 'node:process';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env.DATABASE_URL ?? 'file:./dev.db',
  },
});
