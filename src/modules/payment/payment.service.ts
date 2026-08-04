import { AppError, errorKinds } from '@/app/error';
import { prisma } from '@/utils/prisma';
import { Payment } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import {
  PaymentCreateDTO,
  PaymentStatusUpdateDTO,
} from './payment.schema';
import { PaymentRepository } from './payment.repository';

export class PaymentService extends BaseService<Payment, PaymentCreateDTO> {
  constructor(
    protected readonly repository: PaymentRepository = new PaymentRepository()
  ) {
    super(repository);
  }

  async list(query: any, userId?: string, role?: string) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const scopedWhere =
      role === 'GUEST' && userId
        ? { ...where, booking: { userId } }
        : where;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        include: { booking: { select: { bookingCode: true, userId: true } } },
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
    const payment = await this.repository.findUnique({
      where: { id },
      include: {
        booking: { include: { hotel: true, user: { select: { id: true } } } },
      },
    });

    if (!payment) {
      throw AppError.new(errorKinds.notFound, 'Payment not found');
    }

    if (role === 'GUEST' && payment.booking.userId !== userId) {
      throw AppError.new(errorKinds.forbidden, 'Access denied');
    }

    return payment;
  }

  async create(data: PaymentCreateDTO) {
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      throw AppError.new(errorKinds.notFound, 'Booking not found');
    }

    return this.repository.create({
      data,
      include: { booking: true },
    });
  }

  async updateStatus(id: string, data: PaymentStatusUpdateDTO) {
    const payment = await this.repository.findUnique({ where: { id } });

    if (!payment) {
      throw AppError.new(errorKinds.notFound, 'Payment not found');
    }

    return this.repository.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.transactionRef !== undefined
          ? { transactionRef: data.transactionRef }
          : {}),
        ...(data.paidAt
          ? { paidAt: new Date(data.paidAt) }
          : {}),
      },
      include: { booking: true },
    });
  }

  async delete(id: string, userId?: string, role?: string) {
    await this.getById(id, userId, role);
    return this.repository.delete({ where: { id } });
  }
}
