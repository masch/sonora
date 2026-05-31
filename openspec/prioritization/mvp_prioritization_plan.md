# MVP Task Prioritization Plan - Sonora

This document defines the prioritization strategy and development roadmap for the Minimum Viable Product (MVP) of the **Sonora** application for Umepay. The primary focus of the MVP is to ensure that the poetic nature walk experience is smooth, reliable, and completely friction-free, considering the fundamental constraint: **zero data/Wi-Fi connectivity during the tour**.

---

## Prioritization Strategy

To define what goes first and what can wait, the development is structured around three pillars:

1. **Critical Technical Risk:** Heavy audio offline behavior and large file caching is the most complex part of the system.
2. **Core Value Proposition:** Geofencing (GPS) to unlock the trip and the background audio player are the heart of the experience.
3. **Friction Reduction for the MVP:** Payments and final feedback can be simplified for the first release to accelerate time to market.

---

## Roadmap Phases for the MVP

### Phase 1: Core Offline Experience, Immersion & Feedback (High Priority)

_This phase resolves the core offline mechanics. Without this working robustly, there is no product._

1. **Trip Download Manager (Android)**
   - Download audio tracks (30 mins ≈ 30-50MB) and trip metadata (images, text) using `expo-file-system`.
   - Implement storage check before download.
   - **Strict Requirement:** User MUST download the trip completely before starting (no streaming fallback allowed in MVP).
   - Display a clean download progress UI (Downloading, Success, Error, Deleted).

2. **Background Audio Player & Immersion Mode**
   - Integration of `expo-av` with background playback support and media controls on Android notifications drawer.
   - Handle interruptions (calls, alarms) and headphone disconnection.
   - **Immersion Mode (Exclusive Audio Focus):** Request exclusive OS-level audio focus to suppress/mute incoming notification sounds from other apps during playback.

3. **Offline Post-Trip Feedback Queue**
   - Simple experience/story submission form at the end of the trip.
   - Persistent local caching of feedback (`AsyncStorage` / SQLite) so it can be filled offline.
   - Auto-sync mechanism that uploads the queue once the device detects internet connection.

4. **Offline GPS Geofencing Activation**
   - Offline location tracking using `expo-location`.
   - **GPS Latency Mitigation:** Increase target geofencing radius to 100-150 meters to account for A-GPS lock delays in the forest.
   - Visual status indicator showing GPS signal acquisition progress (e.g., _"Searching for satellite lock..."_).
   - Local distance calculation (Haversine formula) to unlock the "Start Trip" button only when the user is at the physical starting point in Umepay.

---

### Phase 2: Navigation, Tickets and QR (Medium Priority)

5. **Ticket Activation & Intransferibility (DeviceId Binding)**
   - Bind `{TicketId, DeviceId}` during the download phase while the user still has an active internet connection.
   - Persist ticket activation state locally for offline verification.
   - Generate unique device identifiers natively (`expo-device`/`expo-secure-store`) or fallback storage (web).

6. **QR Code Scanner**
   - Integrate `expo-camera` to scan physical QR codes at the trail entry.
   - Parse code coordinates/IDs and redirect user to the trip details page.

7. **Trips Map (Adaptive Support)**
   - Display trip start markers on a map.
   - Implement tile caching or clear static image fallbacks when offline.

---

### Phase 3: Payments (Secondary / MVP Simplification)

8. **Simplified Web Checkout**
   - Integrate links to external checkouts (Mercado Pago / Stripe Checkout) via web browser redirect.
   - Handle webhook completion to generate the Ticket ID sent via email.

---

## Technical Constraints and Decisons

> [!WARNING]
>
> - **iOS via Web (Nice-to-Have Fallback):** Due to strict browser background execution limits on iOS (Safari), the web fallback might experience playback pauses if the user locks the screen. Android native remains the primary target for full offline robustness.
