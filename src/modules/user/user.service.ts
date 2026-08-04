import { AppError, errorKinds } from '@/app/error';
import { User } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import { UserUpdateDTO } from './user.schema';
import { UserRepository } from './user.repository';

export class UserService extends BaseService<User, UserUpdateDTO> {
  constructor(
    protected readonly repository: UserRepository = new UserRepository()
  ) {
    super(repository);
  }

  async list(query: any) {
    const { page = 1, size = 100, where = {}, orderBy = {} } = query;
    const skip = (page - 1) * size;

    const [data, totalCount] = await Promise.all([
      this.repository.findMany({
        orderBy,
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          phoneNumber: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: size,
        where,
      }),
      this.repository.count({ where }),
    ]);

    return { data, page, size, totalCount };
  }

  async getById(id: string) {
    const user = await this.repository.findUnique({
      where: { id },
      select: {
        email: true,
        firstName: true,
        id: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw AppError.new(errorKinds.notFound, 'User not found');
    }

    return user;
  }

  async update(id: string, data: UserUpdateDTO) {
    await this.getById(id);
    return this.repository.update({
      where: { id },
      data,
      select: {
        email: true,
        firstName: true,
        id: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return this.repository.delete({ where: { id } });
  }
}
