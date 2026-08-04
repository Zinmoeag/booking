import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';
import { USER_ROLES } from '@/types/database';

import { BaseController } from '../shared/BaseController';
import {
  hotelCreateSchema,
  hotelFilterQuerySchema,
  hotelUpdateSchema,
} from './hotel.schema';
import { HotelService } from './hotel.service';

@Controller('/api/hotels')
export class HotelController extends BaseController {
  constructor(private readonly service: HotelService = new HotelService()) {
    super();
  }

  @RequestMapper({
    method: 'get',
    path: '/',
    middleware: [
      ValidationMiddleware.validateRequestQuery(hotelFilterQuerySchema),
    ],
  })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const where = this.getQueryFilter(req, {
      zodParser: hotelFilterQuerySchema,
    });
    const result = await this.service.list({ page, size, where });

    return this.sendList(
      res,
      'Hotels retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id' })
  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id);
    return this.sendDetail(res, 'Hotel retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(hotelCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      this.getParsedBody(req, { zodParser: hotelCreateSchema })
    );
    return this.sendDetail(res, 'Hotel created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(hotelUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      this.getParsedBody(req, { zodParser: hotelUpdateSchema })
    );
    return this.sendDetail(res, 'Hotel updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize('ADMIN')],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(req.params.id);
    return this.sendMessage(res, 'Hotel deleted successfully');
  }
}
