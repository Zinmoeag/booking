import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import { authenticate } from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';
import { UserRole } from '@/types/database';

import { BaseController } from '../shared/BaseController';
import { reviewCreateSchema, reviewUpdateSchema } from './review.schema';
import { ReviewService } from './review.service';

@Controller('/api/reviews')
export class ReviewController extends BaseController {
  constructor(
    private readonly service: ReviewService = new ReviewService()
  ) {
    super();
  }

  @RequestMapper({ method: 'get', path: '/' })
  async list(req: Request, res: Response) {
    const { page, size } = this.getQueryPagination(req);
    const user = req.user;
    const result = await this.service.list(
      { page, size },
      user?.id,
      user?.role as UserRole | undefined
    );

    return this.sendList(
      res,
      'Reviews retrieved successfully',
      result.data,
      result.totalCount
    );
  }

  @RequestMapper({ method: 'get', path: '/:id' })
  async getById(req: Request, res: Response) {
    const user = req.user;
    const result = await this.service.getById(
      req.params.id,
      user?.id,
      user?.role as UserRole | undefined
    );
    return this.sendDetail(res, 'Review retrieved successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/',
    middleware: [
      authenticate,
      ValidationMiddleware.validateRequestBody(reviewCreateSchema),
    ],
  })
  async create(req: Request, res: Response) {
    const result = await this.service.create(
      req.user!.id,
      this.getParsedBody(req, { zodParser: reviewCreateSchema })
    );
    return this.sendDetail(res, 'Review created successfully', result, 201);
  }

  @RequestMapper({
    method: 'patch',
    path: '/:id',
    middleware: [
      authenticate,
      ValidationMiddleware.validateRequestBody(reviewUpdateSchema),
    ],
  })
  async update(req: Request, res: Response) {
    const result = await this.service.update(
      req.params.id,
      req.user!.id,
      this.getParsedBody(req, { zodParser: reviewUpdateSchema })
    );
    return this.sendDetail(res, 'Review updated successfully', result);
  }

  @RequestMapper({
    method: 'delete',
    path: '/:id',
    middleware: [authenticate],
  })
  async delete(req: Request, res: Response) {
    await this.service.delete(
      req.params.id,
      req.user!.id,
      req.user!.role as UserRole
    );
    return this.sendMessage(res, 'Review deleted successfully');
  }
}
