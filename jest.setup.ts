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
