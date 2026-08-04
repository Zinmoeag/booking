import { prisma } from '@/utils/prisma';

import { BaseRepository } from '../shared/BaseRepository';

export class BookingRepository extends BaseRepository<typeof prisma.booking> {
  constructor() {
    super(prisma.booking);
  }

  async findOverlappingRooms(
    roomIds: string[],
    checkInDate: Date,
    checkOutDate: Date
  ) {
    return prisma.bookingRoom.findMany({
      where: {
        roomId: { in: roomIds },
        booking: { status: { not: 'CANCELLED' } },
        checkInDate: { lt: checkOutDate },
        checkOutDate: { gt: checkInDate },
      },
      include: { booking: { select: { bookingCode: true, status: true } } },
    });
  }

  async countBookingsByYear(year: number) {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    return prisma.booking.count({
      where: { createdAt: { gte: start, lt: end } },
    });
  }

  async findApplicableRate(roomTypeId: string, date: Date) {
    return prisma.roomRate.findFirst({
      where: {
        roomTypeId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { pricePerNight: 'asc' },
    });
  }
}
