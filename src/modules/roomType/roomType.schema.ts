import { z } from 'zod';

export const roomTypeCreateSchema = z.object({
  hotelId: z.string().min(1, 'hotelId is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable(),
  basePrice: z.number().positive('basePrice must be positive'),
  maxOccupancy: z.number().int().positive('maxOccupancy must be positive'),
  bedCount: z.number().int().positive('bedCount must be positive').default(1),
  amenityIds: z.array(z.string()).optional(),
});

export const roomTypeUpdateSchema = roomTypeCreateSchema.partial();

export type RoomTypeCreateDTO = z.infer<typeof roomTypeCreateSchema>;
export type RoomTypeUpdateDTO = z.infer<typeof roomTypeUpdateSchema>;
