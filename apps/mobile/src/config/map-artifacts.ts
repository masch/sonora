import { mapArchivePath, mapStylePath } from '@sonora/shared';

export interface MapArtifacts {
  archiveUrl: string;
  styleUrl: string;
}

interface MapArtifactsInput {
  /** Origin of the API this build talks to. */
  apiBaseUrl: string;
  /** Build-time override, for a dev run pointed at a deployed environment. */
  archiveUrlOverride?: string;
  styleUrlOverride?: string;
}

/** Hosts that only exist on the machine running the dev server. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0', '10.0.2.2']);

const PRIVATE_HOSTNAME = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * True when the origin is reachable only from this machine or its local network.
 *
 * A local API serves the public bucket from its own simulation, which holds no
 * archive, and a missing archive renders the map error state instead of an empty
 * basemap. An unparseable origin counts as local.
 */
export function isLocalOrigin(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return true;
  }

  return LOCAL_HOSTNAMES.has(hostname) || PRIVATE_HOSTNAME.test(hostname);
}

/**
 * Public map artifacts of the environment this build talks to.
 *
 * Derived from the API origin, the same way the instructions audio url is, so one
 * build configuration serves every environment. The remote config still wins over
 * this: it is the compiled floor for a cold start without network.
 */
export function resolveMapArtifacts({
  apiBaseUrl,
  archiveUrlOverride,
  styleUrlOverride,
}: MapArtifactsInput): MapArtifacts {
  const base = apiBaseUrl.replace(/\/+$/, '');
  const derived = isLocalOrigin(base)
    ? { archiveUrl: '', styleUrl: '' }
    : {
        archiveUrl: `${base}${mapArchivePath()}`,
        styleUrl: `${base}${mapStylePath()}`,
      };

  return {
    archiveUrl: archiveUrlOverride ?? derived.archiveUrl,
    styleUrl: styleUrlOverride ?? derived.styleUrl,
  };
}
