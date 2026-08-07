import { z } from 'zod';
import { GEO_MODES } from '../geo/proximity';

export const RemoteConfigAppVersionSchema = z.object({
  minimumVersion: z.string().min(1),
  blockOlderVersions: z.boolean(),
  gracePeriodStart: z.string().optional(),
  gracePeriodEnd: z.string().optional(),
});

export const RemoteConfigPayloadSchema = z.object({
  geofence: z.object({
    trip: z.object({
      radiusMeters: z.number().positive(),
      defaultMode: z.enum(GEO_MODES),
    }),
    track: z.object({
      radiusMeters: z.number().positive(),
      defaultMode: z.enum(GEO_MODES),
    }),
    bypassGeofence: z.boolean(),
  }),
  audio: z.object({
    rewindOffsetMs: z.number().positive(),
  }),
  feedback: z.object({
    syncIntervalSec: z.number().positive(),
  }),
  appVersion: RemoteConfigAppVersionSchema,
});

export type RemoteConfigPayload = z.infer<typeof RemoteConfigPayloadSchema>;

export const DEFAULT_REMOTE_CONFIG: RemoteConfigPayload = {
  geofence: {
    trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
    track: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
    bypassGeofence: false,
  },
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
  appVersion: { minimumVersion: '0.0.0', blockOlderVersions: false },
};
