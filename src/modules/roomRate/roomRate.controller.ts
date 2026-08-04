import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';

import { BaseController } from '../shared/BaseController';
import {
  roomRateCreateSchema,
  roomRateUpdateSchema,
} from './roomRate.schema';
import { RoomRateService } from './roomRate.service';

@Controller('/api/room-rates')
export class RoomRateController extends BaseController {
  constructor(
    private readonly service: RoomRateService = new RoomRateService()
  ) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/' })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const result = await this.service.list({ page, size });

    return this.sendList(
      res,
      'Room rates retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id' })
  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id);
    return this.sendDetail(res, 'Room rate retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(roomRateCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      this.getParsedBody(req, { zodParser: roomRateCreateSchema })
    );
    return this.sendDetail(res, 'Room rate created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(roomRateUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      this.getParsedBody(req, { zodParser: roomRateUpdateSchema })
    );
    return this.sendDetail(res, 'Room rate updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize('ADMIN')],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(req.params.id);
    return this.sendMessage(res, 'Room rate deleted successfully');
  }
}
