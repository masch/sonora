/**
 * Module-level double for `maplibre-gl`, wired through jest `moduleNameMapper`.
 *
 * The real package is ESM-only (no CJS entry), so jest cannot resolve it, and it
 * needs a WebGL context that jsdom does not provide. Mapping the module here keeps
 * the component's dynamic `import('maplibre-gl')` working under test.
 */

import { FakeMap, mockMapInstances } from './fake-maplibre';

export const addProtocol = jest.fn();
export const setWorkerUrl = jest.fn();

const maplibregl = { Map: FakeMap, addProtocol };

export default maplibregl;
export { FakeMap as Map, FakeMap, mockMapInstances };
