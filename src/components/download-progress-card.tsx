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
      className="card-container gap-4 self-stretch p-4 rounded-[24px]"
      testID="download-progress-card"
    >
      {/* Progress bar and percentage */}
      <TwView className="gap-2">
        <TwView className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <TwView
            testID="progress-bar-fill"
            className={`h-full rounded-full ${
              isCompleted ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </TwView>
        <TwText className="text-xs text-zinc-700 dark:text-zinc-300 text-right font-bold">
          {isCompleted
            ? t('components.downloadCard.statusCompleted')
            : t('components.downloadCard.progressPercent', { value: Math.round(progress) })}
        </TwText>
      </TwView>

      {/* Error message */}
      {isError && errorMsg && (
        <TwText className="text-xs text-rose-600 font-bold">{errorMsg}</TwText>
      )}

      {/* Action buttons */}
      <TwView className="flex-row gap-4">
        {!isCompleted && onDownload && (
          <TwView className="flex-1">
            <TwView className="bg-emerald-500 rounded-xl overflow-hidden shadow-sm">
              <TwPressable
                accessibilityLabel={t('components.downloadCard.btnDownload')}
                testID="download-button"
                className="py-3 items-center active:bg-emerald-600"
                onPress={onDownload}
                disabled={isDownloading}
              >
                <TwText className="text-white font-extrabold text-sm">
                  {t('components.downloadCard.btnDownload')}
                </TwText>
              </TwPressable>
            </TwView>
          </TwView>
        )}
        {onDelete && (
          <TwView className="flex-1">
            <TwView className="bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden shadow-sm">
              <TwPressable
                accessibilityLabel={t('components.downloadCard.btnDelete')}
                testID="delete-button"
                className="py-3 items-center active:bg-zinc-300 dark:active:bg-zinc-800"
                onPress={onDelete}
              >
                <TwText className="text-zinc-800 dark:text-zinc-200 font-extrabold text-sm">
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
