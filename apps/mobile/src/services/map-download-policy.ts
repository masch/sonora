import type { MapDownloadPolicy } from '@sonora/shared';

/**
 * Whether one download may happen without asking the walker.
 *
 * Kept pure and separate from the transfer: the rule is a product decision (when a
 * map may be fetched silently, on which network, under which ceiling) and it is
 * checked as a matrix rather than through the download it starts.
 */

/** How the device is connected, as the connectivity API reports it. */
export type MapNetwork = 'wifi' | 'cellular' | 'offline' | 'other';

/**
 * - `download` — start it now, silently.
 * - `ask` — one prompt for the whole set; nothing starts until the walker accepts.
 * - `skip` — do not download and do not ask: there is no network, or the policy
 *   forbids spending this connection.
 */
export type MapDownloadDecision = 'download' | 'ask' | 'skip';

/**
 * The decision for one archive (or for the whole preload set, by its total size).
 *
 * The ceilings and the cellular policy come from the payload, never from the build,
 * so they are adjustable without a release:
 *
 * - offline downloads nothing, and the app keeps working from what it already has;
 * - on WiFi, under or exactly at `autoMaxBytes`, it downloads silently, and above it
 *   asks — a huge archive is a question even on a free network;
 * - on cellular, `ask` is a question, `never` spends nothing, and `auto` is treated
 *   as WiFi, ceiling included;
 * - on a connection it cannot price (VPN, unknown transport) it asks: guessing right
 *   about someone else's data plan is not worth the gamble.
 */
export function decideDownload({
  bytes,
  network,
  policy,
}: {
  bytes: number;
  network: MapNetwork;
  policy: MapDownloadPolicy;
}): MapDownloadDecision {
  if (network === 'offline') return 'skip';

  if (network === 'cellular') {
    if (policy.cellular === 'never') return 'skip';
    if (policy.cellular === 'ask') return 'ask';
    return bytes <= policy.autoMaxBytes ? 'download' : 'ask';
  }

  if (network === 'wifi') return bytes <= policy.autoMaxBytes ? 'download' : 'ask';

  return 'ask';
}
