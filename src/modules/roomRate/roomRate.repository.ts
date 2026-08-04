import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class RoomRateRepository extends BaseRepository<typeof prisma.roomRate> {
  constructor() {
    super(prisma.roomRate);
  }
}
