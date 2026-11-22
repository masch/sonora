import { useEffect, useState } from 'react';

import { AnalyticsService } from '@/services/analytics';

import { browserCapability } from './browser-capability';

/**
 * Whether this page session already measured the unsupported verdict.
 *
 * A hook-level ref would die with each mount and the count the dashboard reads
 * has to be of devices, not of renders, so the one measurement is a fact of the
 * page: a flag the module itself holds, forgettable only when the page is gone.
 */
let measuredThisPage = false;

/** Forgets the measurement, the way a new page load would. For tests. */
export function resetMeasuredUnsupportedBrowser(): void {
  measuredThisPage = false;
}

/**
 * The browser verdict this page session draws the map under, measured once.
 *
 * The verdict is read lazily once per page: it is about the browser, which does not
 * change while a page is open. An unsupported browser is measured here too — a
 * `trackEvent`, never an error report, because a device that cannot run the map is
 * a condition to count, not a failure of the attempt — so the number of walkers the
 * map is locked away from, and the OS they have, reach the dashboard without any
 * code path having to remember to report them.
 */
export function useMapCapability(): {
  /** False only for a browser the report names; the map is never created for it. */
  mapSupported: boolean;
  /** The device's own OS version, as its user agent spelled it, or `null`. */
  osVersion: string | null;
} {
  const [{ mapSupported, osVersion }] = useState(() => {
    const capability = browserCapability();
    return { mapSupported: capability.mapSupported, osVersion: capability.osVersion };
  });

  useEffect(() => {
    if (mapSupported || measuredThisPage) return;
    measuredThisPage = true;
    AnalyticsService.trackEvent('map_unsupported_browser', {
      os_version: osVersion ?? 'unknown',
    });
  }, [mapSupported, osVersion]);

  return { mapSupported, osVersion };
}
