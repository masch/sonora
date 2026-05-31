/* eslint-disable i18next/no-literal-string */
import { useAppTranslation } from '@/hooks/use-translation';
import * as Device from 'expo-device';
import { Trans } from 'react-i18next';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ScreenWrapper, ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { MaxContentWidth } from '@/constants/theme';
import { useOfflineGeofence } from '@/hooks/use-offline-geofence';
import { TwText, TwView } from '@/tw';

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

  const innerView = (
    <TwView
      style={{
        maxWidth: MaxContentWidth,
      }}
      className="self-center w-full px-6 items-center gap-4"
    >
      <TwView className="items-center justify-center px-6 gap-6 py-16">
        <AnimatedIcon />
        <TwText className="text-3xl font-bold text-center">{t('index.title')}</TwText>
      </TwView>

      <ThemedText type="code" className="uppercase">
        {t('index.getStarted')}
      </ThemedText>

      {/* Temporal Geofence Debug Panel */}
      <TwView className="bg-backgroundElement gap-4 self-stretch p-4 rounded-[24px] border border-emerald-500/20">
        <TwText className="font-bold text-sm text-emerald-400">GPS Offline Geofence Debug</TwText>
        <HintRow
          title="GPS Status"
          hint={<ThemedText type="code">{geofence.gpsStatus}</ThemedText>}
        />
        <HintRow
          title="GPS Accuracy"
          hint={
            <ThemedText type="code">
              {geofence.gpsAccuracy !== null ? `${geofence.gpsAccuracy.toFixed(1)}m` : 'N/A'}
            </ThemedText>
          }
        />
        <HintRow
          title="Distance to Start"
          hint={
            <TwText className="text-sm font-code">
              {geofence.distanceMeters !== null ? `${geofence.distanceMeters.toFixed(1)}m` : 'N/A'}
            </TwText>
          }
        />
        <HintRow
          title="Required Proximity"
          hint={
            <ThemedText type="code">{`${geofence.requiredRadiusMeters}m`}</ThemedText>
          }
        />
        <HintRow
          title="Near Start Location?"
          hint={
            <ThemedText
              type="code"
              className={geofence.isNearStart ? 'text-emerald-400' : 'text-rose-400'}
            >
              {geofence.isNearStart ? `YES (Within ${geofence.requiredRadiusMeters}m)` : 'NO'}
            </ThemedText>
          }
        />
        {geofence.errorMsg && (
          <TwText className="text-xs text-rose-400 mt-1">Error: {geofence.errorMsg}</TwText>
        )}
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
        <TwView className={`${CONTENT_PADDING} flex-1`}>
          {innerView}
        </TwView>
      </ScreenWrapper>
    );
  }

  return (
    <ScrollScreenWrapper contentContainerClassName={CONTENT_PADDING}>
      {innerView}
    </ScrollScreenWrapper>
  );
}
