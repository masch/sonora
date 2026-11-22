/**
 * Whether this browser can run the map at all, read from its own report of itself.
 *
 * Why it exists: MapLibre v6 needs a module worker and WebGL2, and Safari only ships
 * both together from 16.4 — so on iOS 15 the library gets a 200 for the worker file
 * and still dies loading it, the map shows "we couldn't draw the map", and the retry
 * it offers can never succeed. A failure the retry cannot fix is not a failure of the
 * attempt; it is a fact about the device, and the screen has to say so before the map
 * is ever created.
 *
 * Why the user agent and not a runtime probe of the worker: a probe is asynchronous,
 * has to race the map's own init, and its failure is exactly the library error this
 * check exists to prevent. A version read is synchronous, deterministic and testable,
 * and the pair of versions it names is what the walker needs to read: what the map
 * requires, and what the device has.
 */

/** The first Safari release that ships module workers and WebGL2 together. */
export const MAP_REQUIRED_IOS_VERSION = '16.4';

/** The gate compares component by component: a float fold would call 16.10 older than 16.4. */
const REQUIRED_PARTS = MAP_REQUIRED_IOS_VERSION.split('.').map(Number);

/** What the check can tell about a browser, from one user agent string. */
export interface BrowserCapability {
  /**
   * False only for a browser the report names — Safari before 16.4 — and true for
   * every profile that is not recognized: an unknown agent is a wait for evidence,
   * never a refusal, because a map that is locked away from a browser that works is
   * a regression nobody asked for.
   */
  mapSupported: boolean;
  /**
   * The OS version the device reports, formatted for the failure sentence —
   * `iOS 15.8.8` — or `null` when the agent does not name one.
   */
  osVersion: string | null;
  /** The Safari version, for the same sentence, or `null`. */
  browserVersion: string | null;
}

/**
 * An iOS version as the device writes it in its user agent: `15_8_8` on one line
 * and dots on the other would be the same OS, so underscores become dots here.
 */
const IOS_VERSION = /\bOS[ _](\d+(?:[_\d]+)?) like Mac OS X/;
const IOS_VERSION_WITHOUT_LIKE = /\bOS[ _](\d+(?:[_\d]+)?)(?:\s|$|,|\))/;

/** The Safari version: `Version/15.6.8` is the token desktop Safari agrees to share. */
const SAFARI_VERSION = /\bVersion\/(\d+(?:\.\d+)*)/;

const IPHONE = /\biPhone\b|\biPad\b|\biPod\b/;
const SAFARI = /\bSafari\b/;

/** Whether one dotted version names a release at or after the required one. */
function versionAtLeast(version: string, required: number[]): boolean {
  const parts = version.split('.').map(Number);
  for (let index = 0; index < required.length; index += 1) {
    const part = parts[index] ?? 0;
    if (part !== required[index]) return part > (required[index] ?? 0);
  }
  return true;
}

function readVersionLine(ua: string, pattern: RegExp): string | null {
  const found = pattern.exec(ua);
  if (!found) return null;
  return found[1].replace(/_/g, '.');
}

/**
 * Reads one user agent and says whether the map can draw in it.
 *
 * Exported for the tests and the failure sentence; the hook calls `browserCapability`
 * for the live browser.
 */
export function parseBrowserCapability(ua: string): BrowserCapability {
  const osVersion =
    readVersionLine(ua, IOS_VERSION) ?? readVersionLine(ua, IOS_VERSION_WITHOUT_LIKE);
  const browserVersion = readVersionLine(ua, SAFARI_VERSION);

  const isAppleMobile = IPHONE.test(ua);
  const isSafari = browserVersion !== null && SAFARI.test(ua);

  // The gap only exists on Apple mobile Safari: macOS Safari with the same prefix
  // never had it, and no other engine did either. Not recognized falls through to
  // supported — the map's own attempt reports its real failure, if any.
  const isOldSafari = isAppleMobile && isSafari && !versionAtLeast(browserVersion, REQUIRED_PARTS);

  return {
    mapSupported: !isOldSafari,
    osVersion: osVersion === null ? null : `${isAppleMobile ? 'iOS' : 'macOS'} ${osVersion}`,
    browserVersion,
  };
}

/** What this browser reports about itself, or the safe answer when it reports nothing. */
export function browserCapability(): BrowserCapability {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return { mapSupported: true, osVersion: null, browserVersion: null };
  }
  return parseBrowserCapability(navigator.userAgent);
}
