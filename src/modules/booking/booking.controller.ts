import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import {
  authorize,
  authenticate,
} from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';
import { UserRole } from '@/types/database';

import { BaseController } from '../shared/BaseController';
import {
  bookingCreateSchema,
  bookingFilterQuerySchema,
  bookingStatusUpdateSchema,
} from './booking.schema';
import { BookingService } from './booking.service';

@Controller('/api/bookings')
export class BookingController extends BaseController {
  constructor(
    private readonly service: BookingService = new BookingService()
  ) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/', middleware: [authenticate] })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const query = this.getParsedQuery(req, {
      zodParser: bookingFilterQuerySchema,
    });

    const where = {
      ...(query.status ? { status: query.status } : {}),
    };

    const user = req.user!;
    const result = await this.service.list(
      { page, size, where },
      user.id,
      user.role as UserRole
    );

    return this.sendList(
      res,
      'Bookings retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id', middleware: [authenticate] })
  async getById(req: Request, res: Response) {
    const user = req.user!;
    const result = await this.service.getById(
      req.params.id,
      user.id,
      user.role as UserRole
    );
    return this.sendDetail(res, 'Booking retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      ValidationMiddleware.validateRequestBody(bookingCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      req.user!.id,
      this.getParsedBody(req, { zodParser: bookingCreateSchema })
    );
    return this.sendDetail(res, 'Booking created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id/status',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(bookingStatusUpdateSchema),
    ],
  })
  async updateStatus(req: Request, res: Response) {
    const result = await this.service.updateStatus(
      req.params.id,
      this.getParsedBody(req, { zodParser: bookingStatusUpdateSchema })
    );
    return this.sendDetail(res, 'Booking status updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate],
  })
  async cancel(req: Request, res: Response) {
    const user = req.user!;
    const result = await this.service.cancel(
      req.params.id,
      user.id,
      user.role as UserRole
    );
    return this.sendDetail(res, 'Booking cancelled successfully', result);
  }
}
