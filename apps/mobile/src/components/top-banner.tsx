import { Icon } from '@/components/icon';
import { SONORA_BANNER_BG, SONORA_LOGO } from '@/constants/images';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { TwView } from '@/tw';
import { TwImage } from '@/tw/image';

export function TopBanner() {
  const colors = useThemeColors();

  return (
    <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
      <TwImage
        source={SONORA_BANNER_BG}
        className="absolute inset-0 w-full h-full"
        contentFit="cover"
        alt=""
      />
      <TwView className="size-40 items-center justify-center z-10">
        <TwImage source={SONORA_LOGO} className="w-full h-full" contentFit="contain" alt="" />
      </TwView>
      <TwView className="absolute top-4 right-4 bg-white/20 p-2 rounded-full backdrop-blur-md">
        <Icon
          ios="speaker.wave.2.fill"
          android="volume_up"
          web="volume_up"
          size={18}
          tintColor={colors.text}
        />
      </TwView>
    </TwView>
  );
}
