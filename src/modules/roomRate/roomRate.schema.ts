import { z } from 'zod';

export const roomRateCreateSchema = z.object({
  roomTypeId: z.string().min(1, 'roomTypeId is required'),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  pricePerNight: z.number().positive('pricePerNight must be positive'),
});

export const roomRateUpdateSchema = roomRateCreateSchema.partial();

export type RoomRateCreateDTO = z.infer<typeof roomRateCreateSchema>;
export type RoomRateUpdateDTO = z.infer<typeof roomRateUpdateSchema>;
