import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';
import { USER_ROLES } from '@/types/database';

import { BaseController } from '../shared/BaseController';
import { userUpdateSchema } from './user.schema';
import { UserService } from './user.service';

@Controller('/api/users')
export class UserController extends BaseController {
  constructor(private readonly service: UserService = new UserService()) {
    super();
  }

  @RequestMapper({
    method: 'get',
    path: '/',
    middleware: [authenticate, authorize(...USER_ROLES)],
  })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const result = await this.service.list({ page, size });

    return this.sendList(
      res,
      'Users retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({
    method: 'get',
    path: '/:id',
    middleware: [authenticate, authorize(...USER_ROLES)],
  })
  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id);
    return this.sendDetail(res, 'User retrieved successfully', result);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      authorize(...USER_ROLES),
      ValidationMiddleware.validateRequestBody(userUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      this.getParsedBody(req, { zodParser: userUpdateSchema })
    );
    return this.sendDetail(res, 'User updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize(...USER_ROLES)],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(req.params.id);
    return this.sendMessage(res, 'User deleted successfully');
  }
}
