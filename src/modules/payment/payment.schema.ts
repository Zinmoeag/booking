import { z } from 'zod';

import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database';

export const paymentCreateSchema = z.object({
  amount: z.number().positive('amount must be positive'),
  bookingId: z.string().min(1, 'bookingId is required'),
  paymentMethod: z.enum(
    PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]
  ),
  transactionRef: z.string().optional().nullable(),
});

export const paymentStatusUpdateSchema = z.object({
  status: z.enum(PAYMENT_STATUSES as [PaymentStatus, ...PaymentStatus[]]),
  transactionRef: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export const paymentFilterQuerySchema = z.object({
  bookingId: z.string().optional(),
  status: z.enum(PAYMENT_STATUSES as [PaymentStatus, ...PaymentStatus[]]).optional(),
});

export type PaymentCreateDTO = z.infer<typeof paymentCreateSchema>;
export type PaymentStatusUpdateDTO = z.infer<typeof paymentStatusUpdateSchema>;
