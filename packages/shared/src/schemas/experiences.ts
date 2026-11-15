import { z } from 'zod';

export const ExperiencesQuerySchema = z.object({
  email: z.string().email().optional(),
});

export type ExperiencesQuery = z.infer<typeof ExperiencesQuerySchema>;
