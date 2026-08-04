import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class AmenityRepository extends BaseRepository<typeof prisma.amenity> {
  constructor() {
    super(prisma.amenity);
  }
}
