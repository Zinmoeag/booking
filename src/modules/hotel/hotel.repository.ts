import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class HotelRepository extends BaseRepository<typeof prisma.hotel> {
  constructor() {
    super(prisma.hotel);
  }
}
