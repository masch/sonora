import { z } from 'zod';

export const RemoteConfigAppVersionSchema = z.object({
  minimumVersion: z.string().min(1),
  blockOlderVersions: z.boolean(),
  gracePeriodStart: z.string().optional(),
  gracePeriodEnd: z.string().optional(),
});

export const RemoteConfigPayloadSchema = z.object({
  geofence: z.object({
    radiusMeters: z.number().positive(),
    bypassGeofence: z.boolean(),
  }),
  audio: z.object({
    rewindOffsetMs: z.number().positive(),
  }),
  feedback: z.object({
    syncIntervalSec: z.number().positive(),
  }),
  appVersion: RemoteConfigAppVersionSchema,
  showHomeInstructions: z.boolean(),
});

export type RemoteConfigPayload = z.infer<typeof RemoteConfigPayloadSchema>;

export const DEFAULT_REMOTE_CONFIG: RemoteConfigPayload = {
  geofence: { radiusMeters: 50, bypassGeofence: false },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
  appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
  showHomeInstructions: false,
};
