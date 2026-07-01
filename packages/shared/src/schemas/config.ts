import { z } from 'zod';

export const RemoteConfigPayloadSchema = z.object({
  geofence: z.object({
    radiusMeters: z.number().positive(),
  }),
  bypassGeofence: z.boolean(),
  audio: z.object({
    rewindOffsetMs: z.number().positive(),
  }),
  feedback: z.object({
    syncIntervalSec: z.number().positive(),
  }),
});

export type RemoteConfigPayload = z.infer<typeof RemoteConfigPayloadSchema>;

export const DEFAULT_REMOTE_CONFIG: RemoteConfigPayload = {
  geofence: { radiusMeters: 50 },
  bypassGeofence: false,
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
};
