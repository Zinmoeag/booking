import { z } from 'zod';

import {
  BOOKING_STATUSES,
  BookingStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '@/types/database';

export const bookingGuestSchema = z.object({
  fullName: z.string().min(1, 'fullName is required'),
  email: z.string().email().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
  idProofNumber: z.string().optional().nullable(),
});

export const bookingRoomItemSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  checkInDate: z.string().min(1, 'checkInDate is required'),
  checkOutDate: z.string().min(1, 'checkOutDate is required'),
  guests: z.array(bookingGuestSchema).optional(),
});

export const bookingCreateSchema = z.object({
  hotelId: z.string().min(1, 'hotelId is required'),
  rooms: z.array(bookingRoomItemSchema).min(1, 'At least one room is required'),
  paymentMethod: z
    .enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]])
    .optional(),
});

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES as [BookingStatus, ...BookingStatus[]]),
});

export const bookingFilterQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES as [BookingStatus, ...BookingStatus[]]).optional(),
});

export type BookingCreateDTO = z.infer<typeof bookingCreateSchema>;
export type BookingStatusUpdateDTO = z.infer<typeof bookingStatusUpdateSchema>;
