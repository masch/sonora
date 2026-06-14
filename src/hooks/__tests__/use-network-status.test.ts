import { renderHook, act } from '@testing-library/react-hooks';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../use-network-status';

// We access the mock's addEventListener to get the registered handlers.
// The mock is already set up in jest.setup.ts — we just need to capture the callbacks.
interface NetInfoState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

function getNetInfoHandlers(): ((state: NetInfoState) => void)[] {
  return (NetInfo.addEventListener as jest.Mock).mock.calls.map(
    (call: unknown[]) => call[0] as (state: NetInfoState) => void,
  );
}

function simulateNetInfoState(state: NetInfoState): void {
  const handlers = getNetInfoHandlers();
  for (const handler of handlers) {
    handler(state);
  }
}

describe('NetInfo configuration', () => {
  // Separate describe with no beforeEach to preserve module-level import calls
  it('should configure reachability to API health endpoint', () => {
    expect(NetInfo.configure).toHaveBeenCalledWith({
      reachabilityUrl: expect.stringContaining('/health'),
      reachabilityMethod: 'HEAD',
    });
  });
});

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a NetInfo listener on mount', () => {
    renderHook(() => useNetworkStatus());
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(typeof (NetInfo.addEventListener as jest.Mock).mock.calls[0][0]).toBe('function');
  });

  it('should initialize as online', () => {
    // The mock in jest.setup.ts calls the handler immediately with online state
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('should reflect offline state when NetInfo fires disconnect event', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      simulateNetInfoState({ isConnected: false, isInternetReachable: false });
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should toggle between online and offline states', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      simulateNetInfoState({ isConnected: false, isInternetReachable: false });
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      simulateNetInfoState({ isConnected: true, isInternetReachable: true });
    });
    expect(result.current.isOnline).toBe(true);

    act(() => {
      simulateNetInfoState({ isConnected: false, isInternetReachable: false });
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('should clean up the NetInfo listener on unmount', () => {
    const unsubscribe = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(unsubscribe);

    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
