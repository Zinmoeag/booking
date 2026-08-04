import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';

import { BaseController } from '../shared/BaseController';
import {
  amenityCreateSchema,
  amenityUpdateSchema,
} from './amenity.schema';
import { AmenityService } from './amenity.service';

@Controller('/api/amenities')
export class AmenityController extends BaseController {
  constructor(
    private readonly service: AmenityService = new AmenityService()
  ) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/' })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const result = await this.service.list({ page, size });

    return this.sendList(
      res,
      'Amenities retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id' })
  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id);
    return this.sendDetail(res, 'Amenity retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(amenityCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      this.getParsedBody(req, { zodParser: amenityCreateSchema })
    );
    return this.sendDetail(res, 'Amenity created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(amenityUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      this.getParsedBody(req, { zodParser: amenityUpdateSchema })
    );
    return this.sendDetail(res, 'Amenity updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize('ADMIN')],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(req.params.id);
    return this.sendMessage(res, 'Amenity deleted successfully');
  }
}
