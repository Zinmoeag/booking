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
  paymentCreateSchema,
  paymentFilterQuerySchema,
  paymentStatusUpdateSchema,
} from './payment.schema';
import { PaymentService } from './payment.service';

@Controller('/api/payments')
export class PaymentController extends BaseController {
  constructor(
    private readonly service: PaymentService = new PaymentService()
  ) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/', middleware: [authenticate] })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const query = this.getParsedQuery(req, {
      zodParser: paymentFilterQuerySchema,
    });

    const where = {
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
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
      'Payments retrieved successfully',
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
    return this.sendDetail(res, 'Payment retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(paymentCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      this.getParsedBody(req, { zodParser: paymentCreateSchema })
    );
    return this.sendDetail(res, 'Payment created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id/status',
    middleware: [
      authenticate,
      authorize('ADMIN', 'HOTEL_STAFF'),
      ValidationMiddleware.validateRequestBody(paymentStatusUpdateSchema),
    ],
  })
  async updateStatus(req: Request, res: Response) {
    const result = await this.service.updateStatus(
      req.params.id,
      this.getParsedBody(req, { zodParser: paymentStatusUpdateSchema })
    );
    return this.sendDetail(res, 'Payment status updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate, authorize('ADMIN')],
  })
  async delete(req: Request, res: Response) {
    const user = req.user!;
    await this.service.delete(
      req.params.id,
      user.id,
      user.role as UserRole
    );
    return this.sendMessage(res, 'Payment deleted successfully');
  }
}
