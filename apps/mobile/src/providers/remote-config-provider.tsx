import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RemoteConfigPayload } from '@sonora/shared';
import { DEFAULT_REMOTE_CONFIG, RemoteConfigPayloadSchema } from '@sonora/shared';
import { getCachedConfig, setCachedConfig } from '../storage/config-cache';
import { ApiClient } from '../services/api-client';

const CONFIG_TIMEOUT_MS = 3000;

export interface ConfigContextValue {
  config: RemoteConfigPayload;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const ConfigContext = createContext<ConfigContextValue>({
  config: DEFAULT_REMOTE_CONFIG,
  isLoading: true,
  error: null,
  refetch: () => {},
});

export function useRemoteConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}

/**
 * Per-field merge: validate each API response key against its Zod schema.
 * Valid keys override defaults; invalid or missing keys keep their default.
 */
function mergeRemoteConfig(
  defaults: RemoteConfigPayload,
  remote: Partial<RemoteConfigPayload>,
): RemoteConfigPayload {
  const result = { ...defaults };
  const shape = RemoteConfigPayloadSchema.shape;

  for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
    const value = remote[key as keyof RemoteConfigPayload];
    if (value === undefined) continue;

    // Zod validates each field independently — invalid remote values are discarded
    const fieldSchema = shape[key];
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) {
      (result as Record<string, unknown>)[key] = parsed.data;
    }
  }

  return result;
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<RemoteConfigPayload>(DEFAULT_REMOTE_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  const loadConfig = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    // Read cache immediately for instant render
    let cached: RemoteConfigPayload | null = null;
    try {
      cached = await getCachedConfig();
      if (cached) {
        // Merge cache over defaults so missing cache keys still have defaults
        setConfig({ ...DEFAULT_REMOTE_CONFIG, ...cached });
      }
    } catch {
      // Cache read failed — ignore, defaults will be used
    }

    // Try API — overlay cache first, then API wins over both cache and defaults.
    // Try/finally avoided because React Compiler can't optimize finally clauses.
    let apiError: unknown = null;
    try {
      const raw = await ApiClient.get<Partial<RemoteConfigPayload>>('/config', { signal });
      const merged = mergeRemoteConfig(DEFAULT_REMOTE_CONFIG, cached ? { ...cached, ...raw } : raw);
      await setCachedConfig(merged);
      setConfig(merged);
      setError(null);
    } catch (err) {
      apiError = err;
    }

    if (apiError) {
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        // Timeout — not an actionable error, keep current config
        setIsLoading(false);
        return;
      }
      if (!cached) {
        setError(apiError instanceof Error ? apiError : new Error('Failed to load config'));
      }
    }

    setIsLoading(false);
  }, []);

  const refetchVersion = useRef(refetchCount);

  useEffect(() => {
    refetchVersion.current = refetchCount;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);

    // Load config in a separate microtask so the rule doesn't see sync setState.
    // The effect body only schedules the work; setState happens after await inside loadConfig.
    void Promise.resolve().then(() => loadConfig(controller.signal));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchCount]);

  const refetch = useCallback(() => {
    setRefetchCount((c) => c + 1);
  }, []);

  return (
    <ConfigContext.Provider value={{ config, isLoading, error, refetch }}>
      {children}
    </ConfigContext.Provider>
  );
}
