import { AppError, errorKinds } from '@/app/error';
import { prisma } from '@/utils/prisma';
import { RoomRate } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import {
  RoomRateCreateDTO,
  RoomRateUpdateDTO,
} from './roomRate.schema';
import { RoomRateRepository } from './roomRate.repository';

export class RoomRateService extends BaseService<RoomRate, RoomRateCreateDTO> {
  constructor(
    protected readonly repository: RoomRateRepository = new RoomRateRepository()
  ) {
    super(repository);
  }

  async list(query: any) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        include: { roomType: true },
        orderBy,
        skip,
        take: size,
        where,
      }),
      this.repository.count({ where }),
    ]);

    return { data, page, size, totalCount };
  }

  async getById(id: string) {
    const rate = await this.repository.findUnique({
      where: { id },
      include: { roomType: true },
    });

    if (!rate) {
      throw AppError.new(errorKinds.notFound, 'Room rate not found');
    }

    return rate;
  }

  async create(data: RoomRateCreateDTO) {
    const roomType = await prisma.roomType.findUnique({
      where: { id: data.roomTypeId },
    });

    if (!roomType) {
      throw AppError.new(errorKinds.notFound, 'Room type not found');
    }

    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw AppError.new(
        errorKinds.badRequest,
        'startDate must be before endDate'
      );
    }

    return this.repository.create({
      data: {
        endDate: new Date(data.endDate),
        pricePerNight: data.pricePerNight,
        roomTypeId: data.roomTypeId,
        startDate: new Date(data.startDate),
      },
      include: { roomType: true },
    });
  }

  async update(id: string, data: RoomRateUpdateDTO) {
    await this.getById(id);

    const updateData: any = { ...data };

    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
    }

    return this.repository.update({
      where: { id },
      data: updateData,
      include: { roomType: true },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.repository.delete({ where: { id } });
  }
}
