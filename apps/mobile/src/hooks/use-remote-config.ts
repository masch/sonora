import { useRemoteConfigStore } from '@/store/remote-config-store';

/**
 * Convenience hook for components that need the full config state.
 * Prefer `useRemoteConfigStore` with a selector for fine-grained re-renders.
 */
export function useRemoteConfig() {
  return useRemoteConfigStore();
}
