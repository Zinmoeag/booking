import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class UserRepository extends BaseRepository<typeof prisma.user> {
  constructor() {
    super(prisma.user);
  }
}
