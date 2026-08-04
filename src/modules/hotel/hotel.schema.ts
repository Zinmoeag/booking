import { z } from 'zod';

import { numberFilterQuerySchema, stringFilterQuerySchema } from '@/app/core/schema';

export const hotelCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable(),
  addressLine: z.string().min(1, 'addressLine is required'),
  city: z.string().min(1, 'city is required'),
  country: z.string().min(1, 'country is required'),
  postalCode: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export const hotelUpdateSchema = hotelCreateSchema.partial();

export const hotelFilterQuerySchema = z.object({
  city: stringFilterQuerySchema.optional(),
  country: stringFilterQuerySchema.optional(),
  name: stringFilterQuerySchema.optional(),
  rating: numberFilterQuerySchema.optional(),
});

export type HotelCreateDTO = z.infer<typeof hotelCreateSchema>;
export type HotelUpdateDTO = z.infer<typeof hotelUpdateSchema>;
