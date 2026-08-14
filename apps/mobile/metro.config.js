const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot, { isCSSEnabled: true });

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Support .wasm files for expo-sqlite web (wa-sqlite)
config.resolver.assetExts.push('wasm');

// NativeWind configuration:
// - input: points to the global Tailwind CSS stylesheet required for style generation.
// - globalClassNamePolyfill: false disables global React.createElement monkey-patching
//   since this codebase strictly uses styled Tw* wrapper components (src/tw/).
module.exports = withNativewind(config, {
  input: './src/global.css',
  globalClassNamePolyfill: false,
});
