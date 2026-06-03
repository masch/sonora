import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatusState {
  isOnline: boolean;
}

/**
 * Monitors network connectivity using @react-native-community/netinfo.
 * Exposes `isOnline` boolean that auto-updates on connectivity changes.
 */
export function useNetworkStatus(): NetworkStatusState {
  const [isOnline, setIsOnline] = useState(true);
  // Use ref to prevent re-subscribing on every render
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline };
}
