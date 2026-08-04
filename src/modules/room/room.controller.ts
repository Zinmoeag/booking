import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';

import { BaseController } from '../shared/BaseController';
import { roomCreateSchema, roomUpdateSchema } from './room.schema';
import { RoomService } from './room.service';

@Controller('/api/rooms')
export class RoomController extends BaseController {
  constructor(private readonly service: RoomService = new RoomService()) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/' })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const result = await this.service.list({ page, size });

    return this.sendList(
      res,
      'Rooms retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id' })
  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id);
    return this.sendDetail(res, 'Room retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(roomCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      this.getParsedBody(req, { zodParser: roomCreateSchema })
    );
    return this.sendDetail(res, 'Room created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(roomUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      this.getParsedBody(req, { zodParser: roomUpdateSchema })
    );
    return this.sendDetail(res, 'Room updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize('ADMIN')],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(req.params.id);
    return this.sendMessage(res, 'Room deleted successfully');
  }
}
