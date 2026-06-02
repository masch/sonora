const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

// Support .wasm files for expo-sqlite web (wa-sqlite)
config.resolver.assetExts.push('wasm');

module.exports = withNativewind(config, { input: './src/global.css' });
