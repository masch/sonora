import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwText, TwView } from '@/tw';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

interface DownloadProgressCardProps {
  status: DownloadStatus;
  progress: number;
  errorMsg: string | null;
  onDownload?: () => void;
  onDelete?: () => void;
}

export default function DownloadProgressCard({
  status,
  progress,
  errorMsg,
  onDownload,
  onDelete,
}: DownloadProgressCardProps) {
  const { t } = useAppTranslation();

  const isDownloading = status === 'downloading';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  return (
    <TwView
      className="bg-backgroundElement gap-4 self-stretch p-4 rounded-[24px]"
      testID="download-progress-card"
    >
      {/* Progress bar and percentage */}
      <TwView className="gap-2">
        <TwView className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <TwView
            testID="progress-bar-fill"
            className={`h-full rounded-full ${
              isCompleted ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </TwView>
        <TwText className="text-xs text-zinc-400 text-right">
          {isCompleted
            ? t('components.downloadCard.statusCompleted')
            : t('components.downloadCard.progressPercent', { value: Math.round(progress) })}
        </TwText>
      </TwView>

      {/* Error message */}
      {isError && errorMsg && <TwText className="text-xs text-rose-400">{errorMsg}</TwText>}

      {/* Action buttons */}
      <TwView className="flex-row gap-4">
        {!isCompleted && onDownload && (
          <TwView className="flex-1">
            <TwView className="bg-blue-600 rounded-xl overflow-hidden">
              <TwPressable
                accessibilityLabel={t('components.downloadCard.btnDownload')}
                testID="download-button"
                className="py-3 items-center active:bg-blue-700"
                onPress={onDownload}
                disabled={isDownloading}
              >
                <TwText className="text-white font-bold text-sm">
                  {t('components.downloadCard.btnDownload')}
                </TwText>
              </TwPressable>
            </TwView>
          </TwView>
        )}
        {onDelete && (
          <TwView className="flex-1">
            <TwView className="bg-zinc-700 rounded-xl overflow-hidden">
              <TwPressable
                accessibilityLabel={t('components.downloadCard.btnDelete')}
                testID="delete-button"
                className="py-3 items-center active:bg-zinc-800"
                onPress={onDelete}
              >
                <TwText className="text-white font-bold text-sm">
                  {t('components.downloadCard.btnDelete')}
                </TwText>
              </TwPressable>
            </TwView>
          </TwView>
        )}
      </TwView>
    </TwView>
  );
}
