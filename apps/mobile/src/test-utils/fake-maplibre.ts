/**
 * Test double for MapLibre GL. The real library needs a WebGL context, which
 * jest does not provide, so tests drive a fake map instead.
 *
 * Kept outside `__tests__` on purpose: files there are collected as suites.
 */

/** One listener the map holds for an event, and whether the map spends it. */
export interface FakeListener {
  handler: (payload: unknown) => void;
  /** `once`: the map removes it as it fires it, the way MapLibre's `Evented.fire` does. */
  once: boolean;
}

export interface FakeMapInstance {
  /**
   * Every listener registered for an event, in registration order.
   *
   * A list and not one handler per event: MapLibre holds as many listeners as were
   * registered and calls all of them for an event. A flight that was replaced still has
   * the listener it registered, so a double that kept only the newest would hide the
   * path where the stale one is called first.
   */
  listeners: Map<string, FakeListener[]>;
  layers: { id: string; source?: string }[];
  sources: Record<string, { setData: (data: unknown) => void }>;
  options: Record<string, unknown>;
  features: { layer: { id: string }; properties: Record<string, unknown> }[];
  /**
   * Every layout property the renderer wrote, in call order.
   *
   * The web renderer applies the layer selection by rewriting the layers that are
   * already drawn, so this array is the record of that decision: a hidden group
   * shows up here as `visibility: none` on each layer it owns.
   */
  layoutProperties: { layerId: string; name: string; value: string }[];
  /**
   * Every camera flight the renderer asked for, in call order.
   *
   * MapLibre's own shape: one options object per call (`flyTo(options)`), so a
   * renderer that invented a two-argument signature cannot pass through here
   * unnoticed — the real library would ignore the second argument.
   */
  flights: { center: [number, number]; duration?: number; zoom?: number }[];
  on(event: string, handler: (payload: unknown) => void): void;
  /**
   * Registers a handler that fires once and then unregisters itself, the way
   * MapLibre's `once` does: a flight is one move, and `moveend` fires for every
   * move the map makes.
   */
  once(event: string, handler: (payload: unknown) => void): void;
  /** Calls every listener registered for the event, then spends the one-time ones. */
  emit(event: string, payload?: unknown): void;
  emitTap(features: { layer: { id: string }; properties: Record<string, unknown> }[]): void;
}

export const mockMapInstances: FakeMapInstance[] = [];

export class FakeMap implements FakeMapInstance {
  listeners = new Map<string, FakeListener[]>();
  /** A camera move is in the air: the next `flyTo` stops it and reports its landing. */
  moving = false;
  layers: { id: string; source?: string }[] = [];
  sources: Record<string, { setData: (data: unknown) => void }> = {};
  options: Record<string, unknown>;
  features: { layer: { id: string }; properties: Record<string, unknown> }[] = [];
  layoutProperties: { layerId: string; name: string; value: string }[] = [];
  flights: { center: [number, number]; duration?: number; zoom?: number }[] = [];

  constructor(options: Record<string, unknown>) {
    this.options = options;
    mockMapInstances.push(this);
  }

  private register(event: string, handler: (payload: unknown) => void, once: boolean) {
    const registered = this.listeners.get(event) ?? [];
    registered.push({ handler, once });
    this.listeners.set(event, registered);
  }

  on(event: string, handler: (payload: unknown) => void) {
    this.register(event, handler, false);
  }

  once(event: string, handler: (payload: unknown) => void) {
    this.register(event, handler, true);
  }

  remove() {}

  getStyle() {
    // MapLibre's style is the whole picture — the layers the style authored plus the
    // ones added at runtime — and `getStyle()` is how a renderer sees it. `layers`
    // stays the runtime record, because the tests assert on what the renderer added.
    const authored =
      (this.options.style as { layers?: { id: string; source?: string }[] } | undefined)?.layers ??
      [];
    return { layers: [...authored, ...this.layers], sources: this.sources };
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

  setLayoutProperty(layerId: string, name: string, value: string) {
    this.layoutProperties.push({ layerId, name, value });
  }

  fitBounds() {}

  flyTo(options: { center: [number, number]; duration?: number; zoom?: number }) {
    // MapLibre stops the move in progress before it starts the new one, and stopping it
    // reports the landing of the transition that was cut off (`Camera.stop` →
    // `_afterEase` in the real library). That report reaches every listener registered
    // at that moment — including one a flight that was replaced left behind.
    if (this.moving) this.emit('moveend');
    this.moving = true;
    this.flights.push(options);
  }

  getZoom() {
    return 13;
  }

  queryRenderedFeatures() {
    return this.features;
  }

  emit(event: string, payload?: unknown) {
    if (event === 'moveend') this.moving = false;
    const registered = this.listeners.get(event) ?? [];
    // MapLibre's own order (`Evented.fire`): the lasting listeners are called first, and
    // each one-time listener is removed as it is spent. A listener registered for an
    // earlier flight is therefore called before the one the current flight registered.
    for (const listener of registered.filter((entry) => !entry.once)) listener.handler(payload);
    for (const listener of registered.filter((entry) => entry.once)) {
      const index = registered.indexOf(listener);
      if (index >= 0) registered.splice(index, 1);
      listener.handler(payload);
    }
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
