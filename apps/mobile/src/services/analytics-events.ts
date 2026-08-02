/**
 * Shared analytics event map used by both the native (`analytics.ts`) and web
 * (`analytics.web.ts`) AnalyticsService implementations.
 *
 * Single source of truth: keeping these interfaces in one module prevents the
 * web/native drift that previously let PaymentEvents go missing on web.
 */

export interface AppLifecycleEvents {
  app_open: Record<string, never> | undefined;
}

export interface AudioDownloadEvents {
  audio_download_started: { track_id: string; url: string; title: string };
  audio_download_completed: { track_id: string; title: string };
  audio_download_failed: { track_id: string; error_msg: string; title: string };
}

export interface AudioPlaybackEvents {
  audio_playback_started: { track_id: string; uri: string; title: string; resume: boolean };
  audio_playback_paused: { track_id: string; position_ms: number; title: string };
  audio_playback_stopped: { track_id: string; title: string };
  audio_seeked: { track_id: string; position_ms: number; title: string };
  audio_playback_completed: { track_id: string; title: string };
  audio_playback_failed: { track_id: string; error_msg: string; title: string };
}

export interface GpsLocationEvents {
  gps_permission_status: { status: string };
  gps_status_changed: { status: string; accuracy: number | null };
  geofence_entered: { track_id: string; title: string };
  geofence_exited: { track_id: string; title: string };
}

export interface SystemEvents {
  network_status_changed: { is_online: boolean; type: string };
}

export interface TestEvents {
  test_event: { foo: string };
  test_web_event: { foo: string };
}

export interface PaymentEvents {
  payment_checkout_started: { experience_id: string };
  payment_completed: {
    experience_id: string;
    purchase_id: string;
    provider: string;
    /** Amount in minor units (cents) — see AGENTS.md payment conventions. */
    amount: number;
  };
  payment_failed: { experience_id: string; purchase_id: string | null; error_msg?: string };
}

export interface AnalyticsEventMap
  extends
    AppLifecycleEvents,
    AudioDownloadEvents,
    AudioPlaybackEvents,
    GpsLocationEvents,
    SystemEvents,
    TestEvents,
    PaymentEvents {}
