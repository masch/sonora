# GitHub Issues Definition - Sonora MVP

This file contains the specification for the 9 GitHub issues of the Sonora MVP. Each issue follows the conventional format and details the problem description, proposed solution, and acceptance criteria.

---

### Issue 1: feat(offline): implement offline trip download manager

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:high`, `status:needs-review`  
**Description:**  
Implement a local download manager for audio-guided tours. The user needs to download audio tracks (30 mins ≈ 30-50MB) and trip metadata (images, text) via Wi-Fi so the app can function completely offline during the nature walk.

**Proposed Solution:**

- Verify storage space before initiating downloads.
- Use `expo-file-system` to handle background downloads.
- **Strict Requirement:** User MUST download the trip completely before starting (no streaming fallback allowed in MVP).
- Store downloaded media locally and map trip references to the local URIs.
- Add a download progress state (Downloading, Success, Error, Deleted) on the UI.
- Provide a way to delete cached trips to free up storage space.

**Acceptance Criteria:**

- [ ] User can download a full trip assets bundle.
- [ ] UI blocks starting the trip until the download is 100% complete.
- [ ] UI reflects download percentage and status accurately.
- [ ] Assets are accessible and playable offline.
- [ ] Trips can be removed from local storage.

---

### Issue 2: feat(player): implement background audio player with immersion mode

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:high`, `status:needs-review`  
**Description:**  
Integrate a robust audio player capable of playing local downloaded files, continuing playback under locked screen (background mode), and muting third-party notifications during playback to preserve concentration.

**Proposed Solution:**

- Use `expo-av` (or `react-native-track-player` if complex control is needed) configured for background playback.
- Implement OS-level Audio Focus request upon playback. Mute/Suppress background notification sounds.
- Support audio interruptions (phone calls, device alarms) and headphones unplug/disconnections.
- Add notification drawer media controls for Android.

**Acceptance Criteria:**

- [ ] Audio plays smoothly from local cached paths.
- [ ] Audio continues playing when the application is in the background or the screen is locked.
- [ ] Incoming notification sounds are muted or Ducked during active playback.
- [ ] Unplugging headphones automatically pauses playback.

---

### Issue 3: feat(gps): implement offline GPS geofencing activation

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:high`, `status:needs-review`  
**Description:**  
Ensure the user is physically present at the starting coordinate in Umepay before they can start the trip.

**Proposed Solution:**

- Implement offline geolocation tracking using `expo-location`.
- **Mitigation for GPS latency offline:** Increase target geofencing radius to 100-150 meters to account for A-GPS latency in remote areas.
- Add an interactive visual UI indicator that displays the current GPS signal/precision status (e.g., "Searching for satellite connection... Please step outside of dense canopy").
- Calculate the distance between user's current GPS position and trip start point locally using the Haversine formula.
- Keep the "Start Trip" button disabled/blocked unless the user is within the configured radius of the starting coordinate.

**Acceptance Criteria:**

- [ ] GPS reads location even without internet access.
- [ ] User is notified when GPS signal has high uncertainty/low precision.
- [ ] "Start Trip" remains locked when the user is too far from the start coordinate.
- [ ] "Start Trip" unlocks immediately when entering the proximity radius (100-150m).

---

### Issue 4: feat(feedback): implement post-trip offline message queue

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:high`, `status:needs-review`  
**Description:**  
Add a feedback form at the end of the walk where users can write messages to future hikers. Because the user will be offline at the end of the trail, the app must store the feedback locally and sync it automatically once an internet connection is re-established.

**Proposed Solution:**

- Create a simple message submission form at the end of the audio track.
- Store pending messages in local persistence (`AsyncStorage` or SQLite database).
- Set up a background network sync listener (`navigator.onLine` / NetInfo) that automatically sends the queue to the backend once the device is online.

**Acceptance Criteria:**

- [ ] Feedback can be submitted without an internet connection.
- [ ] Messages are cached locally when offline.
- [ ] Messages are automatically sent to the backend once connection is restored, clearing the local queue.

---

### Issue 5: feat(auth): restrict ticket access to a single device (DeviceId binding)

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:medium`, `status:needs-review`  
**Description:**  
Ensure ticket purchases are non-transferable and can only be used on a single device.

**Proposed Solution:**

- Generate a highly entropic device identifier (`DeviceId`) and persist it locally using `expo-secure-store` (natively) or fallback storage (web).
- **Validation Flow:** Ticket validation and `DeviceId` binding MUST occur on-site or in the base _while the user has active internet connection_ during the download phase.
- Once downloaded and bound, the ticket status changes to "Activated" locally. Offline verification of the ticket and QR scan during the walk must match this local state without needing network access.
- Any subsequent download requests for the same `TicketId` using a different `DeviceId` must be rejected by the server.

**Acceptance Criteria:**

- [ ] Ticket is bound to the device used for the first download/activation.
- [ ] Binding happens successfully online during the download phase.
- [ ] Offline run checks against local activation state (no network request on start).
- [ ] Re-using the same ticket code on another device displays an "Access Denied / Ticket Already Registered" message.
- [ ] User can download the same trip multiple times on the _registered_ device.

---

### Issue 6: feat(qr): integrate QR code scanner for trip activation

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:medium`, `status:needs-review`  
**Description:**  
Implement QR code scanner support to easily lookup and initialize the corresponding trip.

**Proposed Solution:**

- Integrate `expo-camera` to scan QR codes on site.
- Parse scanned URLs (e.g. `sonora://trip/{tripId}?ticket={ticketId}` or equivalent web URL).
- Redirect the user directly to the trip detail/download screen.

**Acceptance Criteria:**

- [ ] Scanning a valid QR redirects the user to the correct trip screen.
- [ ] Handles camera permission requests gracefully.

---

### Issue 7: feat(map): show trips map with offline caching

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:medium`, `status:needs-review`  
**Description:**  
Show a map highlighting the starting coordinates of the different available trips.

**Proposed Solution:**

- Implement map viewer using `react-native-maps`.
- Set up offline tile/map caching or provide a clean static map image fallback if native map rendering fails completely due to lack of network.

**Acceptance Criteria:**

- [ ] User can see a map marker at the starting points of trips.
- [ ] App handles map rendering gracefully when no internet is available.

---

### Issue 8: feat(payments): integrate redirect-based web checkout

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:medium`, `status:needs-review`  
**Description:**  
Provide a simple way to buy tickets. To speed up the MVP, avoid heavy native payment SDKs and redirect users to Mercado Pago / Stripe Checkout on the web instead.

**Proposed Solution:**

- Add a "Buy Ticket" button that opens the external web checkout using `expo-web-browser` or `Linking`.
- Upon successful payment, the backend sends the ticket ID via email.

**Acceptance Criteria:**

- [ ] Users can trigger the checkout flow which opens the payment gateway in a web overlay.
- [ ] Purchases generate a valid ticket ID.

---

### Issue 9: chore(feedback): evaluate IndexedDB sync safety for iOS Web offline queue

**Type:** Feature / Enhancement  
**Labels:** `enhancement`, `priority:low`, `status:needs-review`  
**Description:**  
As a post-MVP enhancement, evaluate replacing localStorage with IndexedDB inside Safari for storing feedback comments offline.

**Proposed Solution:**

- Analyze Safari storage eviction policies on iOS.
- Scaffold a fallback sync queue using IndexedDB or Workbox Background Sync to ensure higher durability of user logs and feedback.
