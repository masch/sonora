import { useState } from 'react';
import { Platform } from 'react-native';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import LoadingView from '@/components/loading-view';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useConfirm } from '@/hooks/use-confirm';
import { TwText, TwTextInput, TwView } from '@/tw';
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
  const colors = useThemeColors();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [prevStatus, setPrevStatus] = useState(status);

  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === 'sent' || status === 'queued') {
      setMessage('');
      setValidationError(null);
    }
  }

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setValidationError(t('feedback.form.validation.empty'));
      return;
    }
    setValidationError(null);
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
      title={isSent || isQueued ? undefined : t('feedback.form.title')}
      closeButtonTestID="feedback-dismiss-button"
      footer={
        showInput && !isSending && !isError ? (
          <Button
            label={t('feedback.form.submit')}
            variant="primary"
            testID="feedback-submit-button"
            accessibilityLabel={t('feedback.form.submit')}
            onPress={handleSubmit}
          />
        ) : undefined
      }
    >
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
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            editable={!isSending}
            autoFocus
            testID="feedback-input"
            accessibilityLabel={t('feedback.form.title')}
            onSubmitEditing={handleSubmit}
            blurOnSubmit
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
            <TwView className="py-4 items-center justify-center" testID="feedback-sending-state">
              <LoadingView message={t('feedback.form.sending')} />
            </TwView>
          )}

          {/* Error state with retry */}
          {isError && (
            <TwView className="gap-2" testID="feedback-error-state">
              <TwText className="text-rose-400 text-sm">
                {errorMsg || t('feedback.form.error')}
              </TwText>
              <Button
                label={t('feedback.form.retry')}
                variant="primary"
                className="bg-amber-600 active:bg-amber-700"
                testID="feedback-retry-button"
                accessibilityLabel={t('feedback.form.retry')}
                onPress={handleSubmit}
              />
            </TwView>
          )}
        </>
      )}
    </BottomModal>
  );
}
