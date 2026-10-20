/**
 * Test double for MapLibre GL. The real library needs a WebGL context, which
 * jest does not provide, so tests drive a fake map instead.
 *
 * Kept outside `__tests__` on purpose: files there are collected as suites.
 */

export interface FakeMapInstance {
  handlers: Map<string, (payload: unknown) => void>;
  layers: { id: string; source?: string }[];
  sources: Record<string, { setData: (data: unknown) => void }>;
  options: Record<string, unknown>;
  features: { layer: { id: string }; properties: Record<string, unknown> }[];
  emit(event: string, payload?: unknown): void;
  emitTap(features: { layer: { id: string }; properties: Record<string, unknown> }[]): void;
}

export const mockMapInstances: FakeMapInstance[] = [];

export class FakeMap implements FakeMapInstance {
  handlers = new Map<string, (payload: unknown) => void>();
  layers: { id: string; source?: string }[] = [];
  sources: Record<string, { setData: (data: unknown) => void }> = {};
  options: Record<string, unknown>;
  features: { layer: { id: string }; properties: Record<string, unknown> }[] = [];

  constructor(options: Record<string, unknown>) {
    this.options = options;
    mockMapInstances.push(this);
  }

  on(event: string, handler: (payload: unknown) => void) {
    this.handlers.set(event, handler);
  }

  remove() {}

  getStyle() {
    return { layers: this.layers, sources: this.sources };
  }

  getSource(id: string) {
    return this.sources[id];
  }

  addSource(id: string) {
    this.sources[id] = { setData: jest.fn() };
  }

  removeSource(id: string) {
    delete this.sources[id];
  }

  addLayer(layer: { id: string; source?: string }) {
    this.layers.push(layer);
  }

  removeLayer(id: string) {
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }

  fitBounds() {}

  queryRenderedFeatures() {
    return this.features;
  }

  emit(event: string, payload?: unknown) {
    this.handlers.get(event)?.(payload);
  }

  /** Simulates a tap: sets which features the hit test returns and emits the click. */
  emitTap(features: { layer: { id: string }; properties: Record<string, unknown> }[]) {
    this.features = features;
    this.emit('click', { point: { x: 1, y: 1 } });
  }
}

/** `addProtocol` of the mocked module: registered once per page. */
export const mockAddProtocol = jest.fn();

/**
 * Shape of the mocked `maplibre-gl` module. The real package is ESM-only with
 * named exports, and the component imports it as a namespace, so the double
 * exposes the members both at the top level and under `default`.
 */
/** `setWorkerUrl`: the component points MapLibre at the published worker on import. */
export const mockSetWorkerUrl = jest.fn();

export function fakeMaplibreModule() {
  const members = { Map: FakeMap, addProtocol: mockAddProtocol, setWorkerUrl: mockSetWorkerUrl };
  return { ...members, default: members };
}

/** Shape of the mocked `pmtiles` module. */
export function fakePmtilesModule() {
  return {
    Protocol: class {
      tile = jest.fn();
    },
  };
}
