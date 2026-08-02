import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { APP_CONFIG } from '../config/app-config';
/**
 * Monitors network connectivity using @react-native-community/netinfo.
 * Exposes `isOnline` boolean that auto-updates on connectivity changes.
 */
import { AnalyticsService } from '@/services/analytics';
import { subscribeToNetwork } from '@/utils/net-info';

/**
 * On web, NetInfo checks connectivity by sending a HEAD request to a
 * reachability URL. Default is the page origin, which gets aborted during
 * initial page load (causing harmless NS_BINDING_ABORTED in Firefox,
 * net::ERR_ABORTED in Chrome). Point it to the API health endpoint instead,
 * which responds quickly and has CORS HEAD support.
 */
NetInfo.configure({
  reachabilityUrl: `${APP_CONFIG.apiBaseUrl}/health`,
  reachabilityMethod: 'HEAD',
});

export interface NetworkStatusState {
  isOnline: boolean;
}

export function useNetworkStatus(): NetworkStatusState {
  const [isOnline, setIsOnline] = useState(true);
  // Use ref to prevent re-subscribing on every render
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const unsubscribe = subscribeToNetwork((state) => {
      const connected = state.isConnected ?? false;
      setIsOnline(connected);
      AnalyticsService.trackEvent('network_status_changed', {
        is_online: connected,
        type: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
