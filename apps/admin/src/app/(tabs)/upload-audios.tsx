import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { TwView, TwText, TwPressable, TwTextInput } from '@/tw';
import { AdminApiClient } from '@/services/admin-api-client';
import { useTranslation } from 'react-i18next';

export default function UploadAudiosScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [targetType, setTargetType] = useState<'trip' | 'track'>('trip');
  const [targetId, setTargetId] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleSelectFile = () => {
    // Simulated file selection
    setFileName('audio_guide_sonora_v1.mp3');
  };

  const handleUpload = () => {
    if (!targetId || !audioTitle || !fileName) {
      setUploadStatus(t('uploadAudios.fillFieldsError'));
      return;
    }

    setIsUploading(true);
    setUploadStatus(t('uploadAudios.uploadingStatus'));

    setTimeout(() => {
      setIsUploading(false);
      setUploadStatus(t('uploadAudios.successStatus', { type: targetType, id: targetId }));
      // Reset form
      setTargetId('');
      setAudioTitle('');
      setFileName(null);
      setTimeout(() => setUploadStatus(null), 4000);
    }, 2000);
  };

  const handleLogout = () => {
    AdminApiClient.clearAuthKey();
    router.replace('/login');
  };

  return (
    <ScreenWrapper>
      {/* Header bar */}
      <TwView className="w-full h-16 bg-backgroundElement border-b border-backgroundSelected flex-row items-center justify-between px-five">
        <TwView className="flex-row items-center">
          <TwText className="text-xl font-bold text-text">{t('tabs.uploadAudios')}</TwText>
          <TwView className="ml-three bg-backgroundSelected px-two py-[2px] rounded-md">
            <TwText className="text-xs font-semibold text-textSecondary">
              {t('uploadAudios.adminPortal')}
            </TwText>
          </TwView>
        </TwView>
        <TwPressable
          className="bg-transparent border border-textSecondary px-three py-two rounded-lg hover:bg-backgroundSelected"
          onPress={handleLogout}
          accessibilityLabel={t('dashboard.logout')}
          testID="logout-button"
        >
          <TwText className="text-sm font-semibold text-textSecondary">
            {t('dashboard.logout')}
          </TwText>
        </TwPressable>
      </TwView>

      {/* Main workspace */}
      <TwView className="flex-1 p-five max-w-[800px] w-full mx-auto justify-center">
        <TwView className="card-container rounded-xl p-six bg-backgroundElement/40 shadow-md">
          <ThemedText type="subtitle" className="mb-four text-text">
            {t('uploadAudios.title')}
          </ThemedText>
          <ThemedText type="small" className="text-textSecondary mb-six">
            {t('uploadAudios.subtitle')}
          </ThemedText>

          {/* Type Switcher */}
          <TwView className="flex-row mb-five bg-backgroundElement p-[3px] rounded-lg border border-backgroundSelected self-start">
            <TwPressable
              className={`px-four py-two rounded-md ${targetType === 'trip' ? 'bg-background shadow-sm' : ''}`}
              onPress={() => setTargetType('trip')}
              accessibilityLabel={t('uploadAudios.targetTripAccess')}
              testID="type-trip-button"
            >
              <TwText
                className={`text-sm font-bold ${targetType === 'trip' ? 'text-text' : 'text-textSecondary'}`}
              >
                {t('uploadAudios.trip')}
              </TwText>
            </TwPressable>
            <TwPressable
              className={`px-four py-two rounded-md ${targetType === 'track' ? 'bg-background shadow-sm' : ''}`}
              onPress={() => setTargetType('track')}
              accessibilityLabel={t('uploadAudios.targetTrackAccess')}
              testID="type-track-button"
            >
              <TwText
                className={`text-sm font-bold ${targetType === 'track' ? 'text-text' : 'text-textSecondary'}`}
              >
                {t('uploadAudios.track')}
              </TwText>
            </TwPressable>
          </TwView>

          {/* Form Fields */}
          <TwView className="gap-four mb-six">
            <TwView>
              <TwText className="text-xs font-bold text-textSecondary mb-one uppercase tracking-wider">
                {targetType === 'trip' ? t('uploadAudios.tripId') : t('uploadAudios.trackId')}
              </TwText>
              <TwTextInput
                className="w-full h-10 border border-backgroundSelected rounded-lg px-three text-text bg-background focus:border-link"
                /* eslint-disable-next-line i18next/no-literal-string */
                placeholder={targetType === 'trip' ? 'e.g., trip-123' : 'e.g., track-123'}
                placeholderTextColor="#a59e99"
                value={targetId}
                onChangeText={setTargetId}
                accessibilityLabel={t('uploadAudios.targetIdAccess')}
                testID="target-id-input"
              />
            </TwView>

            <TwView>
              <TwText className="text-xs font-bold text-textSecondary mb-one uppercase tracking-wider">
                {t('uploadAudios.audioTitle')}
              </TwText>
              <TwTextInput
                className="w-full h-10 border border-backgroundSelected rounded-lg px-three text-text bg-background focus:border-link"
                /* eslint-disable-next-line i18next/no-literal-string */
                placeholder="e.g., Intro Guide, Chapter 1..."
                placeholderTextColor="#a59e99"
                value={audioTitle}
                onChangeText={setAudioTitle}
                accessibilityLabel={t('uploadAudios.audioTitleAccess')}
                testID="audio-title-input"
              />
            </TwView>

            {/* File Selector Mock */}
            <TwView className="border-2 border-dashed border-backgroundSelected rounded-lg p-five items-center justify-center bg-background/50">
              <TwView className="mb-two">
                <Icon
                  ios="music.note.list"
                  android="library_music"
                  web="library_music"
                  size={32}
                  tintColor="#8a6e53"
                />
              </TwView>
              {fileName ? (
                <TwView className="items-center">
                  <TwText className="text-sm font-bold text-text mb-two">{fileName}</TwText>
                  <TwPressable
                    className="px-three py-one bg-transparent border border-red-500 rounded hover:bg-red-50"
                    onPress={() => setFileName(null)}
                    accessibilityLabel={t('uploadAudios.removeAccess')}
                    testID="remove-file-button"
                  >
                    <TwText className="text-xs font-semibold text-red-500">
                      {t('uploadAudios.remove')}
                    </TwText>
                  </TwPressable>
                </TwView>
              ) : (
                <TwPressable
                  className="px-four py-two bg-link rounded-lg hover:opacity-90 active:opacity-80"
                  onPress={handleSelectFile}
                  accessibilityLabel={t('uploadAudios.selectFile')}
                  testID="select-file-button"
                >
                  <TwText className="text-sm font-bold text-white">
                    {t('uploadAudios.selectFile')}
                  </TwText>
                </TwPressable>
              )}
            </TwView>
          </TwView>

          {uploadStatus && (
            <TwView className="bg-backgroundElement border border-backgroundSelected rounded-lg p-three mb-four">
              <TwText className="text-sm text-text font-medium">{uploadStatus}</TwText>
            </TwView>
          )}

          {/* Action button */}
          <TwPressable
            className={`w-full py-three bg-link rounded-lg items-center justify-center ${isUploading ? 'opacity-80' : ''}`}
            onPress={handleUpload}
            disabled={isUploading}
            accessibilityLabel={t('uploadAudios.submitAccess')}
            testID="upload-submit-button"
          >
            <TwText className="text-base font-bold text-white">
              {isUploading ? t('uploadAudios.uploading') : t('uploadAudios.uploadBtn')}
            </TwText>
          </TwPressable>
        </TwView>
      </TwView>
    </ScreenWrapper>
  );
}
