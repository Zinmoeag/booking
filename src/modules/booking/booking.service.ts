import { AppError, errorKinds } from '@/app/error';
import { prisma } from '@/utils/prisma';
import { Booking, BookingStatus } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import {
  BookingCreateDTO,
  BookingStatusUpdateDTO,
} from './booking.schema';
import { BookingRepository } from './booking.repository';

const nightsBetween = (start: Date, end: Date) =>
  Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CONFIRMED: ['PENDING'],
  CHECKED_IN: ['CONFIRMED'],
  CHECKED_OUT: ['CHECKED_IN'],
  CANCELLED: ['PENDING', 'CONFIRMED'],
  PENDING: [],
};

export class BookingService extends BaseService<Booking, BookingCreateDTO> {
  constructor(
    protected readonly repository: BookingRepository = new BookingRepository()
  ) {
    super(repository);
  }

  async list(query: any, userId?: string, role?: string) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const scopedWhere = {
      ...where,
      ...(role === 'GUEST' && userId ? { userId } : {}),
    };

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        include: {
          hotel: true,
          payments: true,
          rooms: { include: { room: true, guests: true } },
        },
        orderBy,
        skip,
        take: size,
        where: scopedWhere,
      }),
      this.repository.count({ where: scopedWhere }),
    ]);

    return { data, page, size, totalCount };
  }

  async getById(id: string, userId?: string, role?: string) {
    const booking = await this.repository.findUnique({
      where: { id },
      include: {
        hotel: true,
        payments: true,
        rooms: { include: { room: true, guests: true } },
        reviews: true,
        user: {
          select: { email: true, firstName: true, id: true, lastName: true },
        },
      },
    });

    if (!booking) {
      throw AppError.new(errorKinds.notFound, 'Booking not found');
    }

    if (role === 'GUEST' && booking.userId !== userId) {
      throw AppError.new(errorKinds.forbidden, 'Access denied');
    }

    return booking;
  }

  async create(userId: string, data: BookingCreateDTO) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: data.hotelId },
    });

    if (!hotel) {
      throw AppError.new(errorKinds.notFound, 'Hotel not found');
    }

    const roomIds = data.rooms.map((r) => r.roomId);
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds }, hotelId: data.hotelId },
      include: { roomType: true },
    });

    if (rooms.length !== roomIds.length) {
      throw AppError.new(
        errorKinds.badRequest,
        'One or more rooms do not belong to this hotel'
      );
    }

    for (const item of data.rooms) {
      const checkIn = new Date(item.checkInDate);
      const checkOut = new Date(item.checkOutDate);

      if (checkIn >= checkOut) {
        throw AppError.new(
          errorKinds.badRequest,
          'checkInDate must be before checkOutDate'
        );
      }

      const overlapping = await this.repository.findOverlappingRooms(
        [item.roomId],
        checkIn,
        checkOut
      );

      if (overlapping.length) {
        throw AppError.new(
          errorKinds.alreadyExist,
          `Room is already booked for the selected dates`
        );
      }
    }

    const year = new Date().getFullYear();
    const bookingCount = await this.repository.countBookingsByYear(year);
    const bookingCode = `BK-${year}-${String(bookingCount + 1).padStart(4, '0')}`;

    return prisma.$transaction(async (tx) => {
      let totalAmount = 0;

      const booking = await tx.booking.create({
        data: {
          bookingCode,
          hotelId: data.hotelId,
          status: 'PENDING',
          totalAmount: 0,
          userId,
        },
      });

      for (const item of data.rooms) {
        const room = rooms.find((r) => r.id === item.roomId)!;
        const checkIn = new Date(item.checkInDate);
        const checkOut = new Date(item.checkOutDate);
        const nights = nightsBetween(checkIn, checkOut);

        const rate = await this.repository.findApplicableRate(
          room.roomTypeId,
          checkIn
        );
        const pricePerNight = rate?.pricePerNight ?? room.roomType.basePrice;
        const amount = nights * pricePerNight;
        totalAmount += amount;

        await tx.bookingRoom.create({
          data: {
            bookingId: booking.id,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guests: item.guests?.length
              ? { create: item.guests }
              : undefined,
            pricePerNight,
            roomId: item.roomId,
          },
        });
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: { totalAmount },
      });

      if (data.paymentMethod) {
        await tx.payment.create({
          data: {
            amount: totalAmount,
            bookingId: booking.id,
            paymentMethod: data.paymentMethod,
            status: 'PENDING',
          },
        });
      }

      return tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          hotel: true,
          payments: true,
          rooms: { include: { room: true, guests: true } },
        },
      });
    });
  }

  async updateStatus(
    id: string,
    { status: nextStatus }: BookingStatusUpdateDTO
  ) {
    const booking = await this.repository.findUnique({ where: { id } });

    if (!booking) {
      throw AppError.new(errorKinds.notFound, 'Booking not found');
    }

    const current = booking.status as BookingStatus;

    const allowedFrom = TRANSITIONS[nextStatus];

    if (!allowedFrom.includes(current)) {
      throw AppError.new(
        errorKinds.badRequest,
        `Invalid status transition from ${current} to ${nextStatus}`
      );
    }

    return this.repository.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        hotel: true,
        payments: true,
        rooms: { include: { room: true, guests: true } },
      },
    });
  }

  async cancel(id: string, userId?: string, role?: string) {
    await this.getById(id, userId, role);
    return this.updateStatus(id, { status: 'CANCELLED' });
  }
}
