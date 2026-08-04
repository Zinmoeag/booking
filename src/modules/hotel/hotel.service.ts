import { AppError, errorKinds } from '@/app/error';
import { Hotel } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import { HotelCreateDTO, HotelUpdateDTO } from './hotel.schema';
import { HotelRepository } from './hotel.repository';

export class HotelService extends BaseService<Hotel, HotelCreateDTO> {
  constructor(
    protected readonly repository: HotelRepository = new HotelRepository()
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
    const hotel = await this.repository.findUnique({
      where: { id },
      include: {
        amenities: { include: { amenity: true } },
        roomTypes: { include: { amenities: { include: { amenity: true } } } },
        rooms: true,
      },
    });

    if (!hotel) {
      throw AppError.new(errorKinds.notFound, 'Hotel not found');
    }

    return hotel;
  }

  async create(data: HotelCreateDTO) {
    return this.repository.create({ data });
  }

  async update(id: string, data: HotelUpdateDTO) {
    await this.getById(id);
    return this.repository.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.repository.delete({ where: { id } });
  }
}
