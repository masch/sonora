// Mock for react-native-worklets — required by react-native-reanimated v4.
// The worklet runtime is unavailable in Jest (native-only), so we stub the
// minimal surface consumed by Reanimated in a test environment.

const createSerializable = (value: unknown) => value;
const makeShareableCloneRecursive = (value: unknown) => value;
const makeShareable = (value: unknown) => value;
const runOnRuntime = (_runtime: unknown, fn: (...args: unknown[]) => unknown) => fn;
const createRuntime = () => ({});
const defaultRuntime = {};

module.exports = {
  createSerializable,
  makeShareableCloneRecursive,
  makeShareable,
  runOnRuntime,
  createRuntime,
  defaultRuntime,
};
