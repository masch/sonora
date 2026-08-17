import { z } from 'zod';

/**
 * Request body for `POST /experiences/:id/proximity` (online authoritative check).
 * Carrier of the client's current coordinates only; lat/long bounded to valid ranges.
 */
export const ProximityBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type ProximityBody = z.infer<typeof ProximityBodySchema>;
