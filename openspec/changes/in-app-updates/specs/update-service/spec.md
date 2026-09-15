# update-service Specification

## Purpose

Provide a unified, resilient store update service for Sonora that handles platform-specific deep links and graceful degradation to native store flows.

## Requirements

### Requirement: Platform Store URL Resolution

The system MUST generate platform-appropriate store deep links with resilient web fallbacks based on current application identifiers.

#### Scenario: Android platform resolution

- GIVEN the app is running on an Android device with package ID `org.sonoraderivapoeticas.app`
- WHEN requesting the store URL
- THEN the system resolves the primary deep link `market://details?id=org.sonoraderivapoeticas.app`
- AND resolves the HTTPS fallback `https://play.google.com/store/apps/details?id=org.sonoraderivapoeticas.app`

#### Scenario: iOS platform resolution

- GIVEN the app is running on an iOS device with App Store ID configured
- WHEN requesting the store URL
- THEN the system resolves the App Store URL with `itms-apps` and HTTPS web fallbacks

#### Scenario: Web / Unknown platform resolution

- GIVEN the app is running on Web or an unrecognized platform
- WHEN requesting the store URL
- THEN the system resolves the default web URL fallback

### Requirement: Update Execution with Graceful Degradation

The system MUST trigger the most appropriate update flow for the environment, falling back safely to deep links when native providers fail or are unavailable.

#### Scenario: Trigger update on supported Android with Play Core

- GIVEN the app is running on Android installed via Google Play
- AND the native Play Core provider is available
- WHEN `triggerUpdate()` is invoked with `mode: 'immediate'` or `'flexible'`
- THEN the system starts the native Play Core flow
- AND does not open an external browser or store app

#### Scenario: Trigger update when Play Core is unavailable or fails

- GIVEN the app is running in development, on an emulator, or Play Core encounters an error
- WHEN `triggerUpdate()` is invoked
- THEN the system catches the failure gracefully
- AND opens the platform store deep link via `Linking.openURL()`

#### Scenario: Trigger update on iOS

- GIVEN the app is running on an iOS device
- WHEN `triggerUpdate()` is invoked
- THEN the system opens the App Store deep link via `Linking.openURL()`

### Requirement: UI Trigger Integration

The system MUST allow users to initiate updates directly from both mandatory and optional update interfaces.

#### Scenario: User clicks update on UpdateRequiredModal

- GIVEN the app version status is `'block'` and `UpdateRequiredModal` is visible
- WHEN the user presses the update button
- THEN the system calls `triggerUpdate({ mode: 'immediate' })`

#### Scenario: User clicks update on UpdateWarningBanner

- GIVEN the app version status is `'warn'` and `UpdateWarningBanner` is visible
- WHEN the user presses the update action button
- THEN the system calls `triggerUpdate({ mode: 'flexible' })`
