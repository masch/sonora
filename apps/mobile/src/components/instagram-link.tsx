import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { INSTAGRAM_ICON } from '@/constants/images';
import { useAppTranslation } from '@/hooks/use-translation';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { TwImage, TwPressable, TwView } from '@/tw';
import { openInstagramProfile } from '@/utils/social';

interface InstagramLinkProps {
  className?: string;
  testID?: string;
}

/**
 * Renders a pill link to the official Sonora Instagram profile.
 * Reads the configured handle dynamically from RemoteConfig.
 *
 * Uses the official Instagram brand app icon asset (high-DPI PNG)
 * with the signature brand gradient and squircle silhouette.
 */
export function InstagramLink({
  className = 'items-center justify-center pt-4 pb-2',
  testID = 'home-instagram-link',
}: InstagramLinkProps) {
  const { t } = useAppTranslation();
  const instagramHandle = useRemoteConfigStore((s) => s.config.social?.instagramHandle);

  if (!instagramHandle) return null;

  return (
    <TwView className={className}>
      <TwPressable
        onPress={() => void openInstagramProfile(instagramHandle)}
        accessibilityLabel={t('home.instagramAria', { handle: instagramHandle })}
        accessibilityRole="link"
        testID={testID}
        className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-white/85 border border-white/60 active:opacity-70 shadow-sm"
      >
        <TwImage
          source={INSTAGRAM_ICON}
          className="w-5 h-5 rounded-[5px]"
          contentFit="contain"
          alt=""
        />
        <ThemedText className="text-sm font-semibold text-zinc-900">
          {t('home.instagramHandle', { handle: instagramHandle })}
        </ThemedText>
      </TwPressable>
    </TwView>
  );
}
