import { useState } from 'react';
import { Platform } from 'react-native';
import { BottomModal } from '@/components/ui/bottom-modal';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { LeadClient } from '@/services/lead-client';
import { TwPressable, TwText, TwTextInput, TwView } from '@/tw';
import { LeadEmailSchema, type LeadSource } from '@sonora/shared';

export interface LeadCaptureModalProps {
  visible: boolean;
  onDismiss: () => void;
  source: LeadSource;
  experienceId?: string;
  onSubmitSuccess?: () => void;
  /** Optional submit override for tests or custom handling */
  onSubmit?: (payload: {
    email: string;
    source: LeadSource;
    experienceId?: string;
  }) => Promise<void>;
}

export type LeadSubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function LeadCaptureModal({
  visible,
  onDismiss,
  source,
  experienceId,
  onSubmitSuccess,
  onSubmit,
}: LeadCaptureModalProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LeadSubmissionState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = status === 'submitting';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const resetState = () => {
    setEmail('');
    setStatus('idle');
    setValidationError(null);
    setErrorMessage(null);
  };

  const handleDismiss = () => {
    resetState();
    onDismiss();
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      setValidationError(t('leadCapture.validation.empty'));
      return;
    }

    const emailCheck = LeadEmailSchema.safeParse(trimmed);
    if (!emailCheck.success) {
      setValidationError(t('leadCapture.validation.invalid'));
      return;
    }

    setValidationError(null);
    setErrorMessage(null);
    setStatus('submitting');

    try {
      if (onSubmit) {
        await onSubmit({ email: trimmed, source, experienceId });
      } else {
        await LeadClient.submitLead({
          email: trimmed,
          source,
          experienceId,
        });
      }
      setStatus('success');
      onSubmitSuccess?.();
    } catch {
      setStatus('error');
      setErrorMessage(t('leadCapture.error'));
    }
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
          <TwPressable
            accessibilityLabel={t('leadCapture.close')}
            testID="lead-capture-success-close-button"
            className="mt-4 bg-emerald-500 rounded-xl py-3 px-6 items-center"
            onPress={handleDismiss}
          >
            <ThemedText className="text-white font-bold">{t('leadCapture.close')}</ThemedText>
          </TwPressable>
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
            onChangeText={(text) => {
              setEmail(text);
              if (validationError) setValidationError(null);
            }}
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
            <TwView className="bg-emerald-500 rounded-xl overflow-hidden mt-1">
              <TwPressable
                accessibilityLabel={t('leadCapture.submit')}
                testID="lead-capture-submit-button"
                className="py-3 items-center active:bg-emerald-600"
                onPress={handleSubmit}
              >
                <ThemedText className="text-white font-bold">{t('leadCapture.submit')}</ThemedText>
              </TwPressable>
            </TwView>
          )}
        </>
      )}
    </BottomModal>
  );
}

export default LeadCaptureModal;
