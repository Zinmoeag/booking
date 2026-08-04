import { AppError, errorKinds } from '@/app/error';

import { BaseRepository } from './BaseRepository';

export abstract class BaseService<TModel, TCreate, TUpdate = Partial<TCreate>> {
  constructor(protected readonly repository: BaseRepository<any>) {}

  async getById(id: string, include?: any) {
    const record = await this.repository.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    });

    if (!record) {
      throw AppError.new(errorKinds.notFound, 'Resource not found');
    }

    return record;
  }
}
