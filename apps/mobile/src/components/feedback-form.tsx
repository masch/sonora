import { useState } from 'react';
import { Platform } from 'react-native';
import { BottomModal } from '@/components/ui/bottom-modal';
import { useAppTranslation } from '@/hooks/use-translation';
import { useConfirm } from '@/hooks/use-confirm';
import { TwPressable, TwText, TwTextInput, TwView } from '@/tw';
import type { FeedbackStatus } from '@/types/feedback';

interface FeedbackFormProps {
  visible: boolean;
  onSubmit: (message: string) => void;
  onDismiss: () => void;
  status?: FeedbackStatus;
  errorMsg?: string | null;
}

/**
 * Modal feedback form for post-track feedback.
 * Displays a text input, submit button, and status indicators.
 * Supports sending, sent, queued (offline), and error states.
 */
export default function FeedbackForm({
  visible,
  onSubmit,
  onDismiss,
  status,
  errorMsg,
}: FeedbackFormProps) {
  const { t } = useAppTranslation();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setValidationError(t('feedback.form.validation.empty'));
      return;
    }
    setValidationError(null);
    setMessage('');
    onSubmit(trimmed);
  };

  const discardAndClose = () => {
    setMessage('');
    setValidationError(null);
    onDismiss();
  };

  const { confirm, component: confirmComponent } = useConfirm();

  const handleDismiss = async () => {
    if (!visible) return;
    if (message.trim().length > 0 && !isSent && !isQueued) {
      const ok = await confirm({
        title: t('feedback.form.confirm.title'),
        message: t('feedback.form.confirm.body'),
        confirmLabel: t('feedback.form.confirm.discard'),
        cancelLabel: t('feedback.form.confirm.cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    discardAndClose();
  };

  const isSending = status === 'sending';
  const isSent = status === 'sent';
  const isQueued = status === 'queued';
  const isError = status === 'error';

  const showInput = !isSent && !isQueued;

  return (
    <BottomModal
      visible={visible}
      onDismiss={handleDismiss}
      autoDismissTrigger={isSent || isQueued}
    >
      {/* Header with dismiss */}
      <TwView className="flex-row justify-between items-center">
        <TwText className="text-lg font-bold text-text">{t('feedback.form.title')}</TwText>
        <TwPressable
          accessibilityLabel={t('common.dismiss')}
          testID="feedback-dismiss-button"
          onPress={handleDismiss}
          className="p-2"
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <TwText className="text-textSecondary text-lg">✕</TwText>
        </TwPressable>
      </TwView>

      {isSent && (
        <TwView className="py-8 items-center gap-2" testID="feedback-sent-state">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <TwText className="text-3xl">✓</TwText>
          <TwText className="text-text text-center">{t('feedback.form.sent')}</TwText>
        </TwView>
      )}

      {isQueued && (
        <TwView className="py-8 items-center gap-2" testID="feedback-queued-state">
          <TwText className="text-text text-center">{t('feedback.form.queued')}</TwText>
        </TwView>
      )}

      {confirmComponent}

      {showInput && (
        <>
          {/* Text input (disabled while sending) */}
          <TwTextInput
            className={`bg-backgroundElement text-text rounded-xl p-4 min-h-[100px] ${
              Platform.OS === 'web' ? 'outline-none' : ''
            }`}
            placeholder={t('feedback.form.placeholder')}
            placeholderTextColor="#a1a1aa"
            value={message}
            onChangeText={setMessage}
            multiline
            editable={!isSending}
            autoFocus
            testID="feedback-input"
            accessibilityLabel={t('feedback.form.placeholder')}
            onSubmitEditing={handleSubmit}
            blurOnSubmit={true}
            returnKeyType="send"
          />

          {/* Validation error */}
          {validationError && (
            <TwText className="text-rose-400 text-sm" testID="feedback-validation-error">
              {validationError}
            </TwText>
          )}

          {/* Sending indicator */}
          {isSending && (
            <TwView className="py-4 items-center" testID="feedback-sending-state">
              <TwText className="text-emerald-400 font-bold">{t('feedback.form.sending')}</TwText>
            </TwView>
          )}

          {/* Error state with retry */}
          {isError && (
            <TwView className="gap-2" testID="feedback-error-state">
              <TwText className="text-rose-400 text-sm">
                {errorMsg || t('feedback.form.error')}
              </TwText>
              <TwPressable
                accessibilityLabel={t('feedback.form.retry')}
                testID="feedback-retry-button"
                className="bg-amber-600 rounded-xl py-3 items-center"
                onPress={handleSubmit}
              >
                <TwText className="text-white font-bold">{t('feedback.form.retry')}</TwText>
              </TwPressable>
            </TwView>
          )}

          {/* Submit button (hidden while sending, shown for idle/error) */}
          {!isSending && !isError && (
            <TwView className="bg-emerald-500 rounded-xl overflow-hidden">
              <TwPressable
                accessibilityLabel={t('feedback.form.submit')}
                testID="feedback-submit-button"
                className="py-3 items-center active:bg-emerald-600"
                onPress={handleSubmit}
              >
                <TwText className="text-white font-bold">{t('feedback.form.submit')}</TwText>
              </TwPressable>
            </TwView>
          )}
        </>
      )}
    </BottomModal>
  );
}
