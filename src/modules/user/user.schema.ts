import { z } from 'zod';

import { UserRole, USER_ROLES } from '@/types/database';

export const userUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().nullable().optional(),
  role: z.enum(USER_ROLES as [UserRole, ...UserRole[]]).optional(),
});

export type UserUpdateDTO = z.infer<typeof userUpdateSchema>;
