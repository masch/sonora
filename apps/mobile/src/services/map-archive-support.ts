import { Platform } from 'react-native';

/**
 * Whether this platform can keep a map archive on the device at all.
 *
 * One question, one answer, asked by everything that would touch the archive files:
 * the startup prefetch and the per-trip download button. The browser has no device
 * file system — `expo-file-system` answers there as an unsupported stub, and calling
 * into it throws `this.validatePath is not a function` from inside a render, which is
 * enough to take the whole app down — and it does not need one: MapLibre GL JS reads
 * the archive over HTTP with the browser's own cache in front of it.
 *
 * A capability, and not `Platform.OS === 'web'` scattered across the call sites: the
 * day web gets a storage of its own (Cache Storage, read through the same protocol
 * seam the tiles already use), this module gains an implementation and the callers
 * keep asking the same question.
 */
export function canKeepMapArchive(): boolean {
  return Platform.OS !== 'web';
}
