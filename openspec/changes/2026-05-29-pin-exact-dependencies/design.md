# Design: Pin Exact Dependency Versions

## Technical Decisions

- **Exact Version Mapping**
  Directly mapping dependencies and devDependencies in `package.json` to their resolved versions listed in the lockfile:
  
  | Package | Target Exact Version |
  | --- | --- |
  | `@expo/ui` | `56.0.13` |
  | `@expo/vector-icons` | `15.1.1` |
  | `@tailwindcss/postcss` | `4.3.0` |
  | `expo` | `56.0.4` |
  | `expo-constants` | `56.0.15` |
  | `expo-device` | `56.0.4` |
  | `expo-font` | `56.0.5` |
  | `expo-glass-effect` | `56.0.4` |
  | `expo-image` | `56.0.9` |
  | `expo-linking` | `56.0.11` |
  | `expo-localization` | `56.0.6` |
  | `expo-router` | `56.2.6` |
  | `expo-splash-screen` | `56.0.10` |
  | `expo-status-bar` | `56.0.4` |
  | `expo-symbols` | `56.0.5` |
  | `expo-system-ui` | `56.0.5` |
  | `expo-web-browser` | `56.0.5` |
  | `i18next` | `26.3.0` |
  | `postcss` | `8.5.15` |
  | `react-i18next` | `17.0.8` |
  | `react-native-css` | `3.0.7` |
  | `react-native-gesture-handler` | `2.31.2` |
  | `react-native-safe-area-context` | `5.7.0` |
  | `react-native-web` | `0.21.2` |
  | `tailwindcss` | `4.3.0` |
  | `@testing-library/react-native` | `13.3.3` |
  | `@types/react` | `19.2.15` |
  | `eslint` | `9.39.4` |
  | `eslint-config-expo` | `56.0.4` |
  | `eslint-plugin-i18next` | `6.1.4` |
  | `jest` | `29.7.0` |
  | `jest-expo` | `56.0.4` |
  | `typescript` | `6.0.3` |

## Affected Files
- [package.json](file:///home/masch/dev/js/sonora/package.json)
