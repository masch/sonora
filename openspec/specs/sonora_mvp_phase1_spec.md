# Spec: Sonora MVP Phase 1 Core Services

This specification defines the functional details, technical components, and data structures required to build the offline core of the Sonora MVP.

---

## 1. Trip Download Manager & File System

The download manager coordinates fetching audio and metadata files via Wi-Fi and saving them securely to the device's persistent storage.

### Data Schema (Local Manifest)

```typescript
interface LocalTripMetadata {
  id: string; // e.g. 'umepay-bosque'
  title: string;
  description: string;
  durationMinutes: number;
  startCoordinates: {
    latitude: number;
    longitude: number;
  };
  audioRemoteUrl: string;
  audioLocalPath: string | null;
  downloadStatus: 'idle' | 'downloading' | 'completed' | 'error';
  downloadProgress: number; // 0 to 100
  downloadedAt: string | null;
}
```

### Technical Workflow:

1. **Space Validation:** Use `expo-file-system` to query available free space before initializing download. Ensure the device has at least `1.5x` the file size available.
2. **Download Execution:**
   - Initialize download using `FileSystem.createDownloadResumable`.
   - Update download progress reactive state (hook `useTripDownload(tripId)`).
   - Write files to `FileSystem.documentDirectory + 'trips/{tripId}/audio.mp3'`.
3. **Prevention of Streaming Fallback:** If `downloadStatus !== 'completed'`, the interface must completely disable the "Start Walk" button and show a "Download Required" message.

---

## 2. Background Audio Player & Immersion Mode

The player reads local assets and maintains continuous playback while the screen is locked, while preventing external audio interruptions.

### Audio Focus Control (Android Native)

To enforce the **Immersion Mode**, the player component must request exclusive Audio Focus with the following parameters (mapped through `expo-av` or a native module wrapper):

- **Audio Focus Type:** `AUDIOFOCUS_GAIN` (Exclusive focus).
- **Duck Mode:** Disabled (other applications must be silenced or paused, not just lowered in volume).
- **System Notification Control:** Configure the audio session to duck/silence system notification tones during playback so the poetic narration is not interrupted by messaging apps.

```typescript
import { Audio } from 'expo-av';

async function setupImmersionAudioSession() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false, // Do not duck, force other apps to pause/silence
    playThroughEarpieceAndroid: false,
  });
}
```

### Background Playback & Media Controls:

- Configure a persistent background service (Android foreground service) showing a notification drawer with **Play/Pause/Stop** controls.
- Listen for headphone disconnections (`AVPlaybackStatus` updates) and trigger pause.

---

## 3. Offline GPS Geofencing

Unlocks the trip starting logic locally when the user enters the entrance point.

### Mathematical Proximity Verification:

The distance from the user's location coordinates $(lat_1, lon_1)$ to the target destination $(lat_2, lon_2)$ is calculated using the **Haversine formula**:

$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta lat}{2}\right) + \cos(lat_1) \cos(lat_2) \sin^2\left(\frac{\Delta lon}{2}\right)}\right)$$

Where $R = 6371$ km (Earth's radius).

### Geofencing Execution Flow:

1. **Initial Proximity Check:** Target radius set to **150 meters** to mitigate A-GPS forest lock delays.
2. **Signal Quality Indicator:** Display a visual precision checker based on `Location.LocationAccuracy` and `coords.accuracy` (in meters).
   - If `accuracy > 30` meters: show warning message _"Weak GPS signal. Step away from trees/walls to improve accuracy."_
3. **Offline Mode:** The coordinate comparison is run completely locally inside a React hook `useOfflineGeofence(targetCoords)` utilizing the local JSON metadata.
