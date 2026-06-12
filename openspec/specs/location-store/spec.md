# Location Store Specification

## Purpose

Define the requirements for a single, application-wide location store that handles foreground GPS permissions and coordinates streaming, ensuring consistent location state and battery efficiency.

## Requirements

### Requirement: SingleSharedSubscription

The application MUST maintain at most one active foreground GPS location subscription at any given time.

#### Scenario: App Launch Subscription

- GIVEN the application launches and permissions are granted
- WHEN the main layout mounts
- THEN the system MUST establish exactly one location subscription
- AND this subscription MUST update the global location store

---

### Requirement: GlobalPermissionHandling

The Location Store MUST request foreground location permissions on initialization and expose the permission status or error messages globally.

#### Scenario: Location Permissions Denied

- GIVEN the app initializes
- WHEN the user denies foreground location permissions
- THEN the store MUST transition to a permission error state
- AND expose "Permission to access location was denied" to consumers

---

### Requirement: RealtimeStateDistribution

When coordinates update from the GPS subscription, the store MUST distribute the new latitude, longitude, and accuracy to all subscribed consumers in real-time.

#### Scenario: Coordinates Update propagates to Home and Detail views

- GIVEN the user is on the Home screen or Trip Detail screen
- WHEN the GPS coordinates update
- THEN the home trip distances MUST update automatically
- AND the trip detail map marker MUST update automatically in-place
