import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class RoomRepository extends BaseRepository<typeof prisma.room> {
  constructor() {
    super(prisma.room);
  }
}
