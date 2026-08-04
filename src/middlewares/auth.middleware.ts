import { NextFunction, Request, Response } from 'express';

import { describeSecurity } from '@/app/core/openapi/metadata';
import { AppError, errorKinds } from '@/app/error';
import JwtService from '@/app/helpers/JWT/jwt.service';
import { UserRole } from '@/types/database';
import { prisma } from '@/utils/prisma';

interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

const extractBearerToken = (req: Request): string | undefined => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) return undefined;
  return authorization.slice('Bearer '.length);
};

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw AppError.new(errorKinds.notAuthorized, 'Missing access token');
    }

    let decoded: JwtPayload;
    try {
      decoded = JwtService.verifyToken(
        'ACCESS_TOKEN_PUBLIC_KEY',
        token
      ) as JwtPayload;
    } catch (error) {
      throw AppError.new(errorKinds.invalidToken, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw AppError.new(errorKinds.notAuthorized, 'User no longer exists');
    }

    req.user = { ...user, role: user.role as UserRole };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(...roles: UserRole[]) {
  const guard = (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return next(AppError.new(errorKinds.notAuthorized, 'Not authenticated'));
    }
    if (!roles.includes(user.role)) {
      return next(
        AppError.new(errorKinds.forbidden, 'You do not have permission')
      );
    }
    return next();
  };

  // Tag the guard so the OpenAPI generator can document the required roles
  return describeSecurity(guard, { roles });
}
