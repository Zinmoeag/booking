import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';

import { BaseController } from '../shared/BaseController';
import {
  roomTypeCreateSchema,
  roomTypeUpdateSchema,
} from './roomType.schema';
import { RoomTypeService } from './roomType.service';

@Controller('/api/room-types')
export class RoomTypeController extends BaseController {
  constructor(
    private readonly service: RoomTypeService = new RoomTypeService()
  ) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/' })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const result = await this.service.list({ page, size });

    return this.sendList(
      res,
      'Room types retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id' })
  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id);
    return this.sendDetail(res, 'Room type retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(roomTypeCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      this.getParsedBody(req, { zodParser: roomTypeCreateSchema })
    );
    return this.sendDetail(res, 'Room type created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(roomTypeUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      this.getParsedBody(req, { zodParser: roomTypeUpdateSchema })
    );
    return this.sendDetail(res, 'Room type updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize('ADMIN')],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(req.params.id);
    return this.sendMessage(res, 'Room type deleted successfully');
  }
}
