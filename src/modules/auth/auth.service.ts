import bcrypt from 'bcrypt';

import { AppError, errorKinds } from '@/app/error';
import JwtService from '@/app/helpers/JWT/jwt.service';
import { User, UserRole } from '@/types/database';

import { BaseService } from '../shared/BaseService';
import {
  ChangePasswordDTO,
  LoginDTO,
  RegisterDTO,
} from './auth.schema';
import { AuthRepository } from './auth.repository';
import { AuthResult, TokenPair } from './auth.types';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

const toTokenPayload = (user: {
  id: string;
  email: string;
  role: UserRole;
}) => ({ email: user.email, id: user.id, role: user.role });

const toPublicUser = (user: {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  phoneNumber: string | null;
  role: UserRole;
}) => ({
  email: user.email,
  firstName: user.firstName,
  id: user.id,
  lastName: user.lastName,
  phoneNumber: user.phoneNumber ?? null,
  role: user.role,
});

export class AuthService extends BaseService<
  User,
  RegisterDTO,
  ChangePasswordDTO
> {
  constructor(protected readonly repository: AuthRepository = new AuthRepository()) {
    super(repository);
  }

  async register(data: RegisterDTO): Promise<AuthResult> {
    const existing = await this.repository.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw AppError.new(errorKinds.alreadyExist, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const created = await this.repository
      .create({
        data: {
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          passwordHash,
          phoneNumber: data.phoneNumber ?? null,
          role: 'GUEST' satisfies UserRole,
        },
        select: {
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          phoneNumber: true,
          role: true,
        },
      })
      .catch(() => null);

    if (!created) {
      throw AppError.new(
        errorKinds.internalServerError,
        'Failed to create user'
      );
    }

    const identity = {
      email: created.email,
      id: created.id,
      role: created.role as UserRole,
    };
    const tokens = this.generateTokens(identity);
    return {
      ...tokens,
      user: toPublicUser({ ...created, role: identity.role }),
    };
  }

  async login(data: LoginDTO): Promise<AuthResult> {
    const user = await this.repository.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      throw AppError.new(
        errorKinds.invalidCredential,
        'Invalid email or password'
      );
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordValid) {
      throw AppError.new(
        errorKinds.invalidCredential,
        'Invalid email or password'
      );
    }

    const tokens = this.generateTokens(user);
    return { ...tokens, user: toPublicUser(user) };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let decoded: { id: string; email: string; role: UserRole };
    try {
      decoded = JwtService.verifyToken(
        'REFRESH_TOKEN_PUBLIC_KEY',
        refreshToken
      ) as { id: string; email: string; role: UserRole };
    } catch (error) {
      throw AppError.new(errorKinds.invalidToken, 'Invalid refresh token');
    }

    const user = await this.repository.findUnique({
      where: { id: decoded.id },
      select: { email: true, id: true, role: true },
    });

    if (!user) {
      throw AppError.new(errorKinds.notAuthorized, 'User no longer exists');
    }

    return this.generateTokens(user);
  }

  async getMe(userId: string) {
    const user = await this.repository.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        id: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw AppError.new(errorKinds.notFound, 'User not found');
    }

    return user;
  }

  async changePassword(
    userId: string,
    data: ChangePasswordDTO
  ): Promise<void> {
    const user = await this.repository.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.new(errorKinds.notFound, 'User not found');
    }

    const passwordValid = await bcrypt.compare(
      data.currentPassword,
      user.passwordHash
    );
    if (!passwordValid) {
      throw AppError.new(
        errorKinds.invalidCredential,
        'Current password is incorrect'
      );
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await this.repository.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private generateTokens(user: {
    email: string;
    id: string;
    role: UserRole;
  }): TokenPair {
    const payload = toTokenPayload(user);

    const accessToken = JwtService.signToken('ACCESS_TOKEN_PRIVATE_KEY', payload, {
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshToken = JwtService.signToken(
      'REFRESH_TOKEN_PRIVATE_KEY',
      payload,
      { expiresIn: REFRESH_TOKEN_TTL }
    );

    return { accessToken, refreshToken };
  }
}
