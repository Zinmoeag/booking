import { AppError, errorKinds } from '@/app/error';
import { prisma } from '@/utils/prisma';
import { Room } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import { RoomCreateDTO, RoomUpdateDTO } from './room.schema';
import { RoomRepository } from './room.repository';

export class RoomService extends BaseService<Room, RoomCreateDTO> {
  constructor(
    protected readonly repository: RoomRepository = new RoomRepository()
  ) {
    super(repository);
  }

  async list(query: any) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        include: { hotel: true, roomType: true },
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
    const room = await this.repository.findUnique({
      where: { id },
      include: { hotel: true, roomType: true },
    });

    if (!room) {
      throw AppError.new(errorKinds.notFound, 'Room not found');
    }

    return room;
  }

  async create(data: RoomCreateDTO) {
    const { hotelId, roomTypeId } = data;

    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) {
      throw AppError.new(errorKinds.notFound, 'Hotel not found');
    }

    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) {
      throw AppError.new(errorKinds.notFound, 'Room type not found');
    }

    if (roomType.hotelId !== hotelId) {
      throw AppError.new(
        errorKinds.badRequest,
        'Room type does not belong to the given hotel'
      );
    }

    const duplicate = await this.repository.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber: data.roomNumber } },
    });
    if (duplicate) {
      throw AppError.new(
        errorKinds.alreadyExist,
        'Room number already exists in this hotel'
      );
    }

    return this.repository.create({
      data,
      include: { hotel: true, roomType: true },
    });
  }

  async update(id: string, data: RoomUpdateDTO) {
    await this.getById(id);
    return this.repository.update({
      where: { id },
      data,
      include: { hotel: true, roomType: true },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.repository.delete({ where: { id } });
  }
}
