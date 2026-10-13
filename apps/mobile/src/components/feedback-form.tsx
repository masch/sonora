import { useState } from 'react';
import { BottomModal } from '@/components/ui/bottom-modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icon';
import LoadingView from '@/components/loading-view';
import { useAppTranslation } from '@/hooks/use-translation';
import { useConfirm } from '@/hooks/use-confirm';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwText, TwTextInput, TwView } from '@/tw';
import type { FeedbackStatus } from '@/types/feedback';

interface FeedbackFormProps {
  visible: boolean;
  onSubmit: (message: string) => void;
  onDismiss: () => void;
  status?: FeedbackStatus;
  errorMsg?: string | null;
}

function useFeedbackFormState({
  visible,
  onSubmit,
  onDismiss,
  status,
}: {
  visible: boolean;
  onSubmit: (message: string) => void;
  onDismiss: () => void;
  status?: FeedbackStatus;
}) {
  const { t } = useAppTranslation();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [prevStatus, setPrevStatus] = useState(status);
  const { confirm, component: confirmComponent } = useConfirm();

  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === 'sent' || status === 'queued') {
      setMessage('');
      setValidationError(null);
    }
  }

  const isSending = status === 'sending';
  const isSent = status === 'sent';
  const isQueued = status === 'queued';
  const isError = status === 'error';
  const showInput = !isSent && !isQueued;

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setValidationError(t('feedback.form.validation.empty'));
      return;
    }
    setValidationError(null);
    onSubmit(trimmed);
  };

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
    setMessage('');
    setValidationError(null);
    onDismiss();
  };

  return {
    message,
    setMessage,
    validationError,
    handleSubmit,
    handleDismiss,
    confirmComponent,
    isSending,
    isSent,
    isQueued,
    isError,
    showInput,
    t,
  };
}

function FeedbackSentView() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  return (
    <TwView className="py-8 items-center gap-2" testID="feedback-sent-state">
      <Icon
        ios="checkmark.circle.fill"
        android="check_circle"
        web="check_circle"
        size={32}
        tintColor={colors.buttonSecondaryIcon}
      />
      <TwText className="text-text text-center">{t('feedback.form.sent')}</TwText>
    </TwView>
  );
}

function FeedbackQueuedView() {
  const { t } = useAppTranslation();
  return (
    <TwView className="py-8 items-center gap-2" testID="feedback-queued-state">
      <TwText className="text-text text-center">{t('feedback.form.queued')}</TwText>
    </TwView>
  );
}

interface FeedbackInputFieldsProps {
  message: string;
  setMessage: (val: string) => void;
  validationError: string | null;
  isSending: boolean;
  isError: boolean;
  errorMsg?: string | null;
  onSubmit: () => void;
}

function FeedbackInputFields({
  message,
  setMessage,
  validationError,
  isSending,
  isError,
  errorMsg,
  onSubmit,
}: FeedbackInputFieldsProps) {
  const { t } = useAppTranslation();

  return (
    <>
      <TwTextInput
        className="bg-backgroundElement text-text rounded-xl p-4 min-h-[100px]"
        placeholder={t('feedback.form.placeholder')}
        value={message}
        onChangeText={setMessage}
        multiline
        editable={!isSending}
        autoFocus
        testID="feedback-input"
        accessibilityLabel={t('feedback.form.title')}
        onSubmitEditing={onSubmit}
        blurOnSubmit
        returnKeyType="send"
      />

      {validationError && (
        <TwText className="text-rose-400 text-sm" testID="feedback-validation-error">
          {validationError}
        </TwText>
      )}

      {isSending && (
        <TwView className="py-4 items-center justify-center" testID="feedback-sending-state">
          <LoadingView message={t('feedback.form.sending')} />
        </TwView>
      )}

      {isError && (
        <TwView className="gap-2" testID="feedback-error-state">
          <TwText className="text-rose-400 text-sm">{errorMsg || t('feedback.form.error')}</TwText>
          <Button
            label={t('feedback.form.retry')}
            variant="warning"
            testID="feedback-retry-button"
            accessibilityLabel={t('feedback.form.retry')}
            onPress={onSubmit}
          />
        </TwView>
      )}
    </>
  );
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
  const formState = useFeedbackFormState({
    visible,
    onSubmit,
    onDismiss,
    status,
  });

  const {
    message,
    setMessage,
    validationError,
    handleSubmit,
    handleDismiss,
    confirmComponent,
    isSending,
    isSent,
    isQueued,
    isError,
    showInput,
    t,
  } = formState;

  const footerButton =
    showInput && !isSending && !isError ? (
      <Button
        label={t('feedback.form.submit')}
        variant="primary"
        testID="feedback-submit-button"
        accessibilityLabel={t('feedback.form.submit')}
        onPress={handleSubmit}
      />
    ) : undefined;

  return (
    <BottomModal
      visible={visible}
      onDismiss={handleDismiss}
      autoDismissTrigger={isSent || isQueued}
      title={isSent || isQueued ? undefined : t('feedback.form.title')}
      closeButtonTestID="feedback-dismiss-button"
      footer={footerButton}
    >
      {isSent && <FeedbackSentView />}
      {isQueued && <FeedbackQueuedView />}
      {confirmComponent}
      {showInput && (
        <FeedbackInputFields
          message={message}
          setMessage={setMessage}
          validationError={validationError}
          isSending={isSending}
          isError={isError}
          errorMsg={errorMsg}
          onSubmit={handleSubmit}
        />
      )}
    </BottomModal>
  );
}
