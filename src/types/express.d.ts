import { UserRole } from '@/types/database';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        firstName: string;
        lastName: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

export {};
