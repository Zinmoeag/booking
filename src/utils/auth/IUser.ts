import { UserRole } from '@/types/database';

export interface IUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
