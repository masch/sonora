import { useAppTranslation } from '@/hooks/use-translation';
import * as Device from 'expo-device';
import { Trans } from 'react-i18next';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ScreenWrapper, ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { useTripDownload } from '@/hooks/use-trip-download';
import { TwPressable, TwText, TwView } from '@/tw';

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pt-16 pb-6';

// Technical constants (paths & commands) excluded from translation lists
const HINT_FILE_PATH = 'src/app/index.tsx';
const RESET_PROJECT_COMMAND = 'npm run reset-project';

export default function HomeScreen() {
  const { t } = useAppTranslation();

  const getDevMenuHint = () => {
    if (Platform.OS === 'web') {
      return <ThemedText type="small">{t('index.hints.devtoolsWeb')}</ThemedText>;
    }
    if (Device.isDevice) {
      return (
        <ThemedText type="small">
          <Trans
            i18nKey="index.hints.devtoolsDevice"
            components={[<ThemedText key="code" type="code" />]}
          />
        </ThemedText>
      );
    }
    return (
      <ThemedText type="small">
        <Trans
          i18nKey={
            Platform.OS === 'android' ? 'index.hints.devtoolsAndroid' : 'index.hints.devtoolsIos'
          }
          components={[<ThemedText key="code" type="code" />]}
        />
      </ThemedText>
    );
  };

  const geofence = useOfflineGeofence({
    latitude: -32.21218267316605,
    longitude: -64.73809012343702,
  });

  const download = useTripDownload(
    'umepay-bosque',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  );

  const innerView = (
    <TwView className="self-center w-full max-w-[800px] px-6 items-center gap-4">
      <TwView className="items-center justify-center px-6 gap-6 py-16">
        <AnimatedIcon />
        <TwText className="text-3xl font-bold text-center">{t('index.title')}</TwText>
      </TwView>

      <ThemedText type="code" className="uppercase">
        {t('index.getStarted')}
      </ThemedText>

      {/* Temporal Geofence Debug Panel */}
      <TwView className="bg-backgroundElement gap-4 self-stretch p-4 rounded-[24px] border border-emerald-500/20">
        <TwText className="font-bold text-sm text-emerald-400">
          {t('index.geofence.debugTitle')}
        </TwText>
        <HintRow
          title={t('index.geofence.gpsStatus')}
          hint={<ThemedText type="code">{geofence.gpsStatus}</ThemedText>}
        />
        <HintRow
          title={t('index.geofence.gpsAccuracy')}
          hint={
            <ThemedText type="code">
              {geofence.gpsAccuracy !== null
                ? `${geofence.gpsAccuracy.toFixed(1)}m`
                : t('index.geofence.notAvailable')}
            </ThemedText>
          }
        />
        <HintRow
          title={t('index.geofence.distanceToStart')}
          hint={
            <TwText className="text-sm font-code">
              {geofence.distanceMeters !== null
                ? `${geofence.distanceMeters.toFixed(1)}m`
                : t('index.geofence.notAvailable')}
            </TwText>
          }
        />
        <HintRow
          title={t('index.geofence.requiredProximity')}
          hint={<ThemedText type="code">{`${geofence.requiredRadiusMeters}m`}</ThemedText>}
        />
        <HintRow
          title={t('index.geofence.nearStartLocation')}
          hint={
            <ThemedText
              type="code"
              className={geofence.isNearStart ? 'text-emerald-400' : 'text-rose-400'}
            >
              {geofence.isNearStart
                ? t('index.geofence.yesWithinRadius', { radius: geofence.requiredRadiusMeters })
                : t('index.geofence.no')}
            </ThemedText>
          }
        />
        {geofence.errorMsg && (
          <TwText className="text-xs text-rose-400 mt-1">
            {t('index.geofence.errorPrefix', { error: geofence.errorMsg })}
          </TwText>
        )}
      </TwView>

      {/* Temporal Download Debug Panel */}
      <TwView className="bg-backgroundElement gap-4 self-stretch p-4 rounded-[24px] border border-blue-500/20">
        <TwText className="font-bold text-sm text-blue-400">
          {t('index.downloadDebug.title')}
        </TwText>
        <HintRow
          title={t('index.downloadDebug.status')}
          hint={<ThemedText type="code">{download.status}</ThemedText>}
        />
        <HintRow
          title={t('index.downloadDebug.progress')}
          hint={<ThemedText type="code">{`${download.progress}%`}</ThemedText>}
        />
        {download.localAudioUri && (
          <HintRow
            title={t('index.downloadDebug.localUri')}
            hint={
              <TwText
                className="text-xs font-code text-zinc-400 max-w-[200px]"
                numberOfLines={1}
                ellipsizeMode="head"
              >
                {download.localAudioUri}
              </TwText>
            }
          />
        )}
        {download.errorMsg && (
          <TwText className="text-xs text-rose-400 mt-1">
            {t('index.geofence.errorPrefix', { error: download.errorMsg })}
          </TwText>
        )}
        <TwView className="flex-row gap-4 mt-2">
          <TwView className="flex-1">
            <TwView className="bg-blue-600 rounded-xl overflow-hidden">
              <TwPressable
                accessibilityLabel={t('index.downloadDebug.btnDownload')}
                testID="download-button"
                className="py-3 items-center active:bg-blue-700"
                onPress={download.startDownload}
                disabled={download.status === 'downloading'}
              >
                <TwText className="text-white font-bold text-sm">
                  {t('index.downloadDebug.btnDownload')}
                </TwText>
              </TwPressable>
            </TwView>
          </TwView>
          <TwView className="flex-1">
            <TwView className="bg-zinc-700 rounded-xl overflow-hidden">
              <TwPressable
                accessibilityLabel={t('index.downloadDebug.btnDelete')}
                testID="delete-button"
                className="py-3 items-center active:bg-zinc-800"
                onPress={download.deleteTripLocal}
              >
                <TwText className="text-white font-bold text-sm">
                  {t('index.downloadDebug.btnDelete')}
                </TwText>
              </TwPressable>
            </TwView>
          </TwView>
        </TwView>
      </TwView>

      <TwView className="bg-backgroundElement gap-6 self-stretch p-4 rounded-[24px]">
        <HintRow
          title={t('index.hints.editing')}
          hint={<ThemedText type="code">{HINT_FILE_PATH}</ThemedText>}
        />
        <HintRow title={t('index.hints.devtools')} hint={getDevMenuHint()} />
        <HintRow
          title={t('index.hints.freshStart')}
          hint={<ThemedText type="code">{RESET_PROJECT_COMMAND}</ThemedText>}
        />
      </TwView>

      {Platform.OS === 'web' && <WebBadge />}
    </TwView>
  );

  if (Platform.OS === 'web') {
    return (
      <ScreenWrapper>
        <TwView className={`${CONTENT_PADDING} flex-1`}>{innerView}</TwView>
      </ScreenWrapper>
    );
  }

  return (
    <ScrollScreenWrapper contentContainerClassName={CONTENT_PADDING}>
      {innerView}
    </ScrollScreenWrapper>
  );
}
