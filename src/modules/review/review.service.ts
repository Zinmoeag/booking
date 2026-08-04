import { AppError, errorKinds } from '@/app/error';
import { prisma } from '@/utils/prisma';
import { Review } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import { ReviewCreateDTO, ReviewUpdateDTO } from './review.schema';
import { ReviewRepository } from './review.repository';

const recomputeHotelRating = async (hotelId: string) => {
  const result = await prisma.review.aggregate({
    _avg: { rating: true },
    where: { hotelId },
  });

  await prisma.hotel.update({
    where: { id: hotelId },
    data: { rating: Math.round((result._avg.rating ?? 0) * 10) / 10 },
  });
};

export class ReviewService extends BaseService<Review, ReviewCreateDTO> {
  constructor(
    protected readonly repository: ReviewRepository = new ReviewRepository()
  ) {
    super(repository);
  }

  async list(query: any, userId?: string, role?: string) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const scopedWhere =
      role === 'GUEST' && userId ? { ...where, userId } : where;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        include: { hotel: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } },
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
    const review = await this.repository.findUnique({
      where: { id },
      include: { hotel: true, user: { select: { firstName: true, lastName: true } } },
    });

    if (!review) {
      throw AppError.new(errorKinds.notFound, 'Review not found');
    }

    if (role === 'GUEST' && review.userId !== userId) {
      throw AppError.new(errorKinds.forbidden, 'Access denied');
    }

    return review;
  }

  async create(userId: string, data: ReviewCreateDTO) {
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      throw AppError.new(errorKinds.notFound, 'Booking not found');
    }

    if (booking.userId !== userId) {
      throw AppError.new(errorKinds.forbidden, 'You can only review your own bookings');
    }

    if (booking.status !== 'CHECKED_OUT') {
      throw AppError.new(
        errorKinds.badRequest,
        'You can only review a checked-out booking'
      );
    }

    const existing = await this.repository.findUnique({
      where: { bookingId: data.bookingId },
    });

    if (existing) {
      throw AppError.new(errorKinds.alreadyExist, 'Booking already reviewed');
    }

    const review = await this.repository.create({
      data: {
        bookingId: data.bookingId,
        comment: data.comment ?? null,
        hotelId: booking.hotelId,
        rating: data.rating,
        userId,
      },
      include: { hotel: true },
    });

    await recomputeHotelRating(booking.hotelId);

    return review;
  }

  async update(id: string, userId: string, data: ReviewUpdateDTO) {
    const review = await this.repository.findUnique({ where: { id } });

    if (!review) {
      throw AppError.new(errorKinds.notFound, 'Review not found');
    }

    if (review.userId !== userId) {
      throw AppError.new(errorKinds.forbidden, 'You can only edit your own review');
    }

    const updated = await this.repository.update({
      where: { id },
      data: {
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
      },
      include: { hotel: true },
    });

    await recomputeHotelRating(review.hotelId);

    return updated;
  }

  async delete(id: string, userId: string, role?: string) {
    const review = await this.repository.findUnique({ where: { id } });

    if (!review) {
      throw AppError.new(errorKinds.notFound, 'Review not found');
    }

    if (role !== 'ADMIN' && review.userId !== userId) {
      throw AppError.new(errorKinds.forbidden, 'You can only delete your own review');
    }

    await this.repository.delete({ where: { id } });
    await recomputeHotelRating(review.hotelId);
    return { id };
  }
}
