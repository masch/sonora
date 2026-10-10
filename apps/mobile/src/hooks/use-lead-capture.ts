import { useState, useRef } from 'react';
import { useAppTranslation } from '@/hooks/use-translation';
import { LeadClient } from '@/services/lead-client';
import { LeadEmailSchema, type LeadSource } from '@sonora/shared';

export type LeadSubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export interface UseLeadCaptureOptions {
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

export interface UseLeadCaptureResult {
  email: string;
  setEmail: (email: string) => void;
  status: LeadSubmissionState;
  validationError: string | null;
  errorMessage: string | null;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  handleSubmit: () => Promise<void>;
  resetState: () => void;
  handleDismiss: () => void;
}

/**
 * Controller hook for lead capture form and submission lifecycle.
 * Encapsulates Zod validation, request deduplication/token invalidation,
 * submission state transitions, and API client execution.
 */
export function useLeadCapture({
  source,
  experienceId,
  onSubmitSuccess,
  onSubmit,
}: UseLeadCaptureOptions): UseLeadCaptureResult {
  const { t } = useAppTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LeadSubmissionState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestIdRef = useRef(0);

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
    requestIdRef.current++;
    resetState();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

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

    const currentRequestId = ++requestIdRef.current;
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
      if (currentRequestId !== requestIdRef.current) return;
      setStatus('success');
      onSubmitSuccess?.();
    } catch {
      if (currentRequestId !== requestIdRef.current) return;
      setStatus('error');
      setErrorMessage(t('leadCapture.error'));
    }
  };

  return {
    email,
    setEmail: (text: string) => {
      setEmail(text);
      if (validationError) setValidationError(null);
    },
    status,
    validationError,
    errorMessage,
    isSubmitting,
    isSuccess,
    isError,
    handleSubmit,
    resetState,
    handleDismiss,
  };
}
