import { AppError, errorKinds } from '@/app/error';
import { prisma } from '@/utils/prisma';
import { RoomType } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import {
  RoomTypeCreateDTO,
  RoomTypeUpdateDTO,
} from './roomType.schema';
import { RoomTypeRepository } from './roomType.repository';

export class RoomTypeService extends BaseService<
  RoomType,
  RoomTypeCreateDTO
> {
  constructor(
    protected readonly repository: RoomTypeRepository = new RoomTypeRepository()
  ) {
    super(repository);
  }

  async list(query: any) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        include: { amenities: { include: { amenity: true } } },
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
    const roomType = await this.repository.findUnique({
      where: { id },
      include: { amenities: { include: { amenity: true } } },
    });

    if (!roomType) {
      throw AppError.new(errorKinds.notFound, 'Room type not found');
    }

    return roomType;
  }

  async create(data: RoomTypeCreateDTO) {
    const { amenityIds = [], ...rest } = data;

    await this.ensureHotelExists(rest.hotelId);
    await this.ensureAmenitiesExist(amenityIds);

    return this.repository.create({
      data: {
        ...rest,
        amenities: amenityIds.length
          ? { create: amenityIds.map((amenityId) => ({ amenityId })) }
          : undefined,
      },
      include: { amenities: { include: { amenity: true } } },
    });
  }

  async update(id: string, data: RoomTypeUpdateDTO) {
    await this.getById(id);

    const { amenityIds, ...rest } = data;

    if (amenityIds) {
      await this.ensureAmenitiesExist(amenityIds);
    }

    return this.repository.update({
      where: { id },
      data: {
        ...rest,
        ...(amenityIds
          ? {
              amenities: {
                deleteMany: {},
                create: amenityIds.map((amenityId) => ({ amenityId })),
              },
            }
          : {}),
      },
      include: { amenities: { include: { amenity: true } } },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.repository.delete({ where: { id } });
  }

  private async ensureHotelExists(hotelId: string) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) {
      throw AppError.new(errorKinds.notFound, 'Hotel not found');
    }
  }

  private async ensureAmenitiesExist(amenityIds: string[]) {
    if (!amenityIds.length) return;

    const count = await prisma.amenity.count({
      where: { id: { in: amenityIds } },
    });

    if (count !== amenityIds.length) {
      throw AppError.new(
        errorKinds.badRequest,
        'One or more amenities do not exist'
      );
    }
  }
}
