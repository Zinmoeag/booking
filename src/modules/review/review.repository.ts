import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class ReviewRepository extends BaseRepository<typeof prisma.review> {
  constructor() {
    super(prisma.review);
  }
}
