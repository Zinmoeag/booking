import { Request, Response } from 'express';

import { Controller, RequestMapper } from '@/app/core/route';
import { authenticate } from '@/middlewares/auth.middleware';
import ValidationMiddleware from '@/middlewares/validationMiddleware';

import { BaseController } from '../shared/BaseController';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.schema';
import { AuthService } from './auth.service';

@Controller('/api/auth')
export class AuthController extends BaseController {
  constructor(private readonly service: AuthService = new AuthService()) {
    super();
  }

  @RequestMapper({
    method: 'post',
    path: '/register',
    middleware: [
      ValidationMiddleware.validateRequestBody(registerSchema),
    ],
  })
  async register(req: Request, res: Response) {
    const result = await this.service.register(
      this.getParsedBody(req, { zodParser: registerSchema })
    );
    return this.sendDetail(res, 'Registered successfully', result, 201);
  }

  @RequestMapper({
    method: 'post',
    path: '/login',
    middleware: [ValidationMiddleware.validateRequestBody(loginSchema)],
  })
  async login(req: Request, res: Response) {
    const result = await this.service.login(
      this.getParsedBody(req, { zodParser: loginSchema })
    );
    return this.sendDetail(res, 'Logged in successfully', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/refresh',
    middleware: [ValidationMiddleware.validateRequestBody(refreshTokenSchema)],
  })
  async refresh(req: Request, res: Response) {
    const { refreshToken } = this.getParsedBody(req, {
      zodParser: refreshTokenSchema,
    });
    const result = await this.service.refresh(refreshToken);
    return this.sendDetail(res, 'Token refreshed successfully', result);
  }

  @RequestMapper({
    method: 'get',
    path: '/me',
    middleware: [authenticate],
  })
  async me(req: Request, res: Response) {
    const result = await this.service.getMe(req.user!.id);
    return this.sendDetail(res, 'Current user retrieved', result);
  }

  @RequestMapper({
    method: 'post',
    path: '/change-password',
    middleware: [
      authenticate,
      ValidationMiddleware.validateRequestBody(changePasswordSchema),
    ],
  })
  async changePassword(req: Request, res: Response) {
    await this.service.changePassword(
      req.user!.id,
      this.getParsedBody(req, { zodParser: changePasswordSchema })
    );
    return this.sendMessage(res, 'Password changed successfully');
  }
}
