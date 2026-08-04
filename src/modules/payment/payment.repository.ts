import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class PaymentRepository extends BaseRepository<typeof prisma.payment> {
  constructor() {
    super(prisma.payment);
  }
}
