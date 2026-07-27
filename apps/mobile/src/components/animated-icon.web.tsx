import { EXPO_LOGO } from '@/constants/images';
import { TwView } from '@/tw';
import { Image } from 'expo-image';

export function AnimatedSplashOverlay() {
  return null;
}

export function AnimatedIcon() {
  return (
    <TwView className="justify-center items-center w-32 h-32">
      <TwView className="justify-center items-center">
        <Image className="absolute w-[76px] h-[71px]" source={EXPO_LOGO} alt="" />
      </TwView>
    </TwView>
  );
}
