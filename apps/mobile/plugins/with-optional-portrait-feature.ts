import { AndroidConfig, type ConfigPlugin, withAndroidManifest } from 'expo/config-plugins';

/**
 * `orientation: 'portrait'` makes Expo emit
 * `<uses-feature android:name="android.hardware.screen.portrait" android:required="true"/>`,
 * which blocks installation on tablets, desktop and Android XR and triggers a
 * Play Console pre-launch report warning. The app still stays locked to
 * portrait on phones (the activity orientation is unchanged); we only declare
 * the feature as optional so those devices are no longer excluded.
 * https://developer.android.com/develop/ui/compose/layouts/adaptive/increase-app-availability
 */
const withOptionalPortraitFeature: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const manifestFields = manifest as unknown as Record<
      string,
      Array<{ $: Record<string, string> }>
    >;

    const features = manifestFields['uses-feature'] ?? [];
    const portrait = features.find(
      (feature) => feature.$?.['android:name'] === 'android.hardware.screen.portrait',
    );

    if (portrait) {
      portrait.$['android:required'] = 'false';
    } else {
      manifestFields['uses-feature'] = [
        ...features,
        {
          $: {
            'android:name': 'android.hardware.screen.portrait',
            'android:required': 'false',
          },
        },
      ];
    }

    return modConfig;
  });
};

export default withOptionalPortraitFeature;
