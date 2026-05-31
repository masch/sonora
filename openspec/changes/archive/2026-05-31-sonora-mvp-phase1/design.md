# Design: Sonora MVP Phase 1 Architecture

This design document maps the technical components, folder structures, and interface components required to implement the Phase 1 Core Services.

---

## 1. File Structure Architecture

We will organize the code using the Container-Presentational pattern and custom React Hooks to separate native side-effects from the user interface.

```
src/
├── app/
│   └── trips/
│       └── [id].tsx                  # Trip Detail screen (Container)
├── hooks/
│   ├── use-trip-download.ts          # State machine for file system download
│   ├── use-offline-geofence.ts       # Coordinate calculator & GPS accuracy checker
│   └── use-immersion-player.ts       # Audio focus manager & playback events controller
├── utils/
│   └── haversine.ts                  # Distance calculation helper
└── components/
    ├── download-progress-card.tsx    # Presentational status component (Tailwind v4)
    ├── gps-precision-badge.tsx       # UI warning badge for GPS signal strength
    └── audio-media-controls.tsx      # Player scrubber and play/pause interface
```

---

## 2. Technical Component Designs

### `use-trip-download.ts` (Download Manager Hook)

Handles downloading using `expo-file-system`.

- **State Properties:** `status: 'idle' | 'downloading' | 'completed' | 'error'`, `progress: number`, `error: string | null`.
- **Trigger Methods:** `startDownload()`, `deleteTripLocal()`.
- **Logic:** Queries free disk space (`FileSystem.getFreeDiskStorageAsync`) and ensures space is $> 1.5x$ the size of target bundle.

### `use-offline-geofence.ts` (Proximity Activation Hook)

Tracks client location and updates activation state.

- **Hook Arguments:** `targetCoords: { latitude: number, longitude: number }`.
- **State Properties:** `isNearStart: boolean`, `gpsAccuracy: number`, `gpsStatus: 'initializing' | 'weak' | 'ready'`.
- **Calculations:** Uses local helper `utils/haversine.ts`. Unlocks target when distance is $\le 50$ meters (tightened from 150m during implementation). Sets `gpsStatus = 'weak'` if coordinate accuracy error is $> 30$ meters.

### `use-immersion-player.ts` (Exclusive Audio Player Hook)

Manages the audio cycle utilizing `expo-av`.

- **Setup:** Configures the Android Audio Session Mode to request exclusive gain.
- **Listeners:**
  - `AVPlaybackStatus` events (triggers pause on buffer limits or hardware disconnection).
  - Background task state updates.

---

## 3. UI Component Specifications (Tailwind / NativeWind)

We will build the visual layers using Sonora's theme tokens defined in `global.css`.

- **DownloadProgressCard:** Renders a progress bar with dynamic widths (`w-[X%]`) using harmonious Tailwind colors (e.g. `bg-emerald-500` for completed status and progress tracking). Includes a detailed file size tracker.
- **GpsPrecisionBadge:** A status pill positioned at the top of the details view. Shows an orange/yellow gradient glow (`from-amber-500 to-orange-600`) when GPS precision is low, urging the user to move away from tree canopy.
