import { z } from 'zod';

import { ROOM_STATUSES, RoomStatus } from '@/types/database';

export const roomCreateSchema = z.object({
  hotelId: z.string().min(1, 'hotelId is required'),
  roomTypeId: z.string().min(1, 'roomTypeId is required'),
  roomNumber: z.string().min(1, 'roomNumber is required'),
  floor: z.number().int().optional().nullable(),
  status: z
    .enum(ROOM_STATUSES as [RoomStatus, ...RoomStatus[]])
    .optional(),
});

export const roomUpdateSchema = roomCreateSchema.partial();

export type RoomCreateDTO = z.infer<typeof roomCreateSchema>;
export type RoomUpdateDTO = z.infer<typeof roomUpdateSchema>;
