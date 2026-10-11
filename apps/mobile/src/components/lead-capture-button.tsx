import { useState } from 'react';
import { Platform } from 'react-native';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useLeadCapture } from '@/hooks/use-lead-capture';
import { TwPressable, TwText, TwTextInput, TwView } from '@/tw';
import type { LeadSource } from '@sonora/shared';

export interface LeadCaptureButtonProps {
  source: LeadSource;
  experienceId?: string;
  className?: string;
  onSubmitSuccess?: () => void;
}

interface InternalModalProps {
  visible: boolean;
  onDismiss: () => void;
  source: LeadSource;
  experienceId?: string;
  onSubmitSuccess?: () => void;
}

function LeadCaptureModalInternal({
  visible,
  onDismiss,
  source,
  experienceId,
  onSubmitSuccess,
}: InternalModalProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const {
    email,
    setEmail,
    validationError,
    errorMessage,
    isSubmitting,
    isSuccess,
    isError,
    handleSubmit,
    handleDismiss: dismissModal,
  } = useLeadCapture({
    source,
    experienceId,
    onSubmitSuccess,
  });

  const handleDismiss = () => {
    dismissModal();
    onDismiss();
  };

  return (
    <BottomModal
      visible={visible}
      onDismiss={handleDismiss}
      autoDismissTrigger={isSuccess}
      autoDismissDelay={3000}
    >
      {/* Header with dismiss */}
      <TwView className="flex-row justify-between items-center">
        <ThemedText className="text-lg font-bold text-text">{t('leadCapture.title')}</ThemedText>
        <TwPressable
          accessibilityLabel={t('common.dismiss')}
          testID="lead-capture-dismiss-button"
          onPress={handleDismiss}
          className="p-2"
        >
          <Icon
            ios="xmark"
            android="close"
            web="close"
            size={18}
            tintColor={colors.textSecondary}
          />
        </TwPressable>
      </TwView>

      {/* Description */}
      {!isSuccess && (
        <ThemedText className="text-sm text-textSecondary">
          {t('leadCapture.description')}
        </ThemedText>
      )}

      {/* Success State */}
      {isSuccess && (
        <TwView className="py-6 items-center gap-3" testID="lead-capture-success-state">
          <Icon
            ios="checkmark.circle.fill"
            android="check_circle"
            web="check_circle"
            size={40}
            tintColor={colors.text}
          />
          <ThemedText className="text-lg font-bold text-text text-center">
            {t('leadCapture.successTitle')}
          </ThemedText>
          <ThemedText className="text-sm text-textSecondary text-center">
            {t('leadCapture.successMessage')}
          </ThemedText>
          <Button
            label={t('leadCapture.close')}
            variant="primary"
            testID="lead-capture-success-close-button"
            accessibilityLabel={t('leadCapture.close')}
            className="mt-4 px-6"
            onPress={handleDismiss}
          />
        </TwView>
      )}

      {/* Input & Form (visible when not in success state) */}
      {!isSuccess && (
        <>
          <TwTextInput
            className={`bg-backgroundElement text-text rounded-xl p-4 ${
              Platform.OS === 'web' ? 'outline-none' : ''
            }`}
            placeholder={t('leadCapture.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            testID="lead-capture-email-input"
            accessibilityLabel={t('leadCapture.emailPlaceholder')}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
          />

          {/* Validation error */}
          {validationError && (
            <TwText className="text-rose-400 text-sm" testID="lead-capture-validation-error">
              {validationError}
            </TwText>
          )}

          {/* API Error state */}
          {isError && (
            <TwView className="gap-2" testID="lead-capture-error-state">
              <TwText className="text-rose-400 text-sm">
                {errorMessage || t('leadCapture.error')}
              </TwText>
            </TwView>
          )}

          {/* Submitting indicator */}
          {isSubmitting && (
            <TwView
              className="py-4 items-center justify-center"
              testID="lead-capture-sending-state"
            >
              <LoadingView message={t('leadCapture.submitting')} />
            </TwView>
          )}

          {/* Submit button */}
          {!isSubmitting && (
            <Button
              label={t('leadCapture.submit')}
              variant="primary"
              testID="lead-capture-submit-button"
              accessibilityLabel={t('leadCapture.submit')}
              className="mt-1"
              onPress={handleSubmit}
            />
          )}
        </>
      )}
    </BottomModal>
  );
}

/**
 * Self-contained lead capture action component.
 * Encapsulates the trigger button and its internal modal per AGENTS.md §1.
 */
export function LeadCaptureButton({
  source,
  experienceId,
  className,
  onSubmitSuccess,
}: LeadCaptureButtonProps) {
  const { t } = useAppTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button
        label={t('leadCapture.button')}
        variant="secondary"
        iconName="mail"
        testID="lead-capture-open-button"
        accessibilityLabel={t('leadCapture.button')}
        className={className}
        onPress={() => setVisible(true)}
      />

      <LeadCaptureModalInternal
        visible={visible}
        onDismiss={() => setVisible(false)}
        source={source}
        experienceId={experienceId}
        onSubmitSuccess={onSubmitSuccess}
      />
    </>
  );
}

export default LeadCaptureButton;
