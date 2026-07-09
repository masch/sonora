/**
 * Jest setup — runs before each test suite.
 */

// Use manual mock from __mocks__/react-native-reanimated.ts
jest.mock('react-native-reanimated');
// Use manual mock from __mocks__/react-i18next.ts
jest.mock('react-i18next');
// react-native-worklets mock for reanimated dependency
jest.mock('react-native-worklets', () => {
  const WM = {
    makeShareableClone: (v: unknown) => v,
    scheduleOnUI: () => {},
    scheduleOnRN: jest.fn((...args: unknown[]) => undefined),
  };
  return WM;
});

// Mock expo-sqlite/kv-store for offline queue storage
const mockKvStore = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getItemSync: jest.fn(() => null),
  setItemSync: jest.fn(),
};
jest.mock('expo-sqlite/kv-store', () => mockKvStore);

// Mock @react-native-community/netinfo for network monitoring
const mockNetInfoState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: {},
};
jest.mock('@react-native-community/netinfo', () => ({
  configure: jest.fn(),
  addEventListener: jest.fn((handler: (state: typeof mockNetInfoState) => void) => {
    handler(mockNetInfoState);
    return jest.fn();
  }),
  fetch: jest.fn(() => Promise.resolve(mockNetInfoState)),
  useNetInfo: jest.fn(() => mockNetInfoState),
  refresh: jest.fn(() => Promise.resolve(mockNetInfoState)),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const insetValues = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => insetValues,
  };
});

// Mock expo-router globally
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      useEffect(() => {
        cb();
      }, []);
    },
    useLocalSearchParams: () => ({}),
    useRouter: () => ({
      push: jest.fn(),
    }),
    Stack: {
      Screen: () => null,
    },
  };
});

// Mock expo-audio globally
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  useAudioPlayerStatus: jest.fn(() => ({})),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-firebase packages globally
jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: {
    apps: [],
    initializeApp: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
  }),
}));

jest.mock('@react-native-firebase/crashlytics', () => ({
  __esModule: true,
  default: () => ({
    recordError: jest.fn(),
    setAttribute: jest.fn(),
  }),
}));

// Mock web firebase SDK packages globally to prevent CJS/ESM loading crashes
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn().mockReturnValue({}),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn().mockReturnValue({}),
  logEvent: jest.fn(),
}));
