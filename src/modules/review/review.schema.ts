import { z } from 'zod';

export const reviewCreateSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
});

export const reviewUpdateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional().nullable(),
});

export type ReviewCreateDTO = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateDTO = z.infer<typeof reviewUpdateSchema>;
