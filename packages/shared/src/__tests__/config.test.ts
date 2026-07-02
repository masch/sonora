import { describe, it, expect } from 'vitest';
import {
  RemoteConfigPayloadSchema,
  DEFAULT_REMOTE_CONFIG,
  type RemoteConfigPayload,
} from '../schemas/config';

describe('RemoteConfigPayloadSchema', () => {
  const fullPayload: RemoteConfigPayload = {
    geofence: { radiusMeters: 50, bypassGeofence: false },
    audio: { rewindOffsetMs: 10000 },
    feedback: { syncIntervalSec: 30 },
  };

  describe('valid inputs', () => {
    it('parses a valid full payload', () => {
      const result = RemoteConfigPayloadSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
    });

    it('preserves all fields on parse', () => {
      const result = RemoteConfigPayloadSchema.parse(fullPayload);
      expect(result).toEqual(fullPayload);
    });
  });

  it('rejects empty payload (no defaults in schema)', () => {
    const result = RemoteConfigPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  describe('rejects invalid values', () => {
    it('rejects negative radiusMeters', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.radiusMeters;
      expect(schema.safeParse(-10).success).toBe(false);
    });

    it('rejects zero radiusMeters', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.radiusMeters;
      expect(schema.safeParse(0).success).toBe(false);
    });

    it('rejects negative rewindOffsetMs', () => {
      const schema = RemoteConfigPayloadSchema.shape.audio.shape.rewindOffsetMs;
      expect(schema.safeParse(-1).success).toBe(false);
    });

    it('rejects zero rewindOffsetMs', () => {
      const schema = RemoteConfigPayloadSchema.shape.audio.shape.rewindOffsetMs;
      expect(schema.safeParse(0).success).toBe(false);
    });

    it('rejects negative syncIntervalSec', () => {
      const schema = RemoteConfigPayloadSchema.shape.feedback.shape.syncIntervalSec;
      expect(schema.safeParse(-5).success).toBe(false);
    });

    it('rejects non-number radiusMeters', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.radiusMeters;
      expect(schema.safeParse('fifty').success).toBe(false);
    });

    it('rejects non-boolean bypassGeofence', () => {
      const schema = RemoteConfigPayloadSchema.shape.geofence.shape.bypassGeofence;
      expect(schema.safeParse('yes').success).toBe(false);
    });
  });

  describe('TypeScript types', () => {
    it('DEFAULT_REMOTE_CONFIG satisfies RemoteConfigPayload', () => {
      const check: RemoteConfigPayload = DEFAULT_REMOTE_CONFIG;
      expect(check.geofence.bypassGeofence).toBe(false);
    });
  });
});
