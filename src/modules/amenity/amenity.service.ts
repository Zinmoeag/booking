import { AppError, errorKinds } from '@/app/error';
import { Amenity } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import { AmenityCreateDTO, AmenityUpdateDTO } from './amenity.schema';
import { AmenityRepository } from './amenity.repository';

export class AmenityService extends BaseService<Amenity, AmenityCreateDTO> {
  constructor(
    protected readonly repository: AmenityRepository = new AmenityRepository()
  ) {
    super(repository);
  }

  async list(query: any) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({ orderBy, skip, take: size, where }),
      this.repository.count({ where }),
    ]);

    return { data, page, size, totalCount };
  }

  async getById(id: string) {
    const amenity = await this.repository.findUnique({ where: { id } });

    if (!amenity) {
      throw AppError.new(errorKinds.notFound, 'Amenity not found');
    }

    return amenity;
  }

  async create(data: AmenityCreateDTO) {
    const existing = await this.repository.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw AppError.new(errorKinds.alreadyExist, 'Amenity already exists');
    }

    return this.repository.create({ data });
  }

  async update(id: string, data: AmenityUpdateDTO) {
    await this.getById(id);
    return this.repository.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.repository.delete({ where: { id } });
  }
}
