import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class RoomTypeRepository extends BaseRepository<typeof prisma.roomType> {
  constructor() {
    super(prisma.roomType);
  }
}
