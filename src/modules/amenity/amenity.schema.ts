import { z } from 'zod';

export const amenityCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  category: z.string().optional().nullable(),
});

export const amenityUpdateSchema = amenityCreateSchema.partial();

export type AmenityCreateDTO = z.infer<typeof amenityCreateSchema>;
export type AmenityUpdateDTO = z.infer<typeof amenityUpdateSchema>;
