import { SymbolView } from 'expo-symbols';
import { PropsWithChildren, useState } from 'react';
import { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { TwView, TwPressable } from '@/tw';
import { TwAnimatedView } from '@/tw/animated';
import { useThemeColors } from '@/hooks/use-theme-colors';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useThemeColors();

  return (
    <TwView>
      <TwPressable
        className="flex-row items-center gap-2 active:opacity-70"
        onPress={() => setIsOpen((value) => !value)}
      >
        <TwView className="bg-backgroundElement w-6 h-6 rounded-xl justify-center items-center">
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={colors.text}
            style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}
          />
        </TwView>

        <ThemedText type="small">{title}</ThemedText>
      </TwPressable>
      {isOpen && (
        <TwAnimatedView entering={FadeIn.duration(200)}>
          <TwView className="bg-backgroundElement mt-4 rounded-2xl ml-6 p-6">{children}</TwView>
        </TwAnimatedView>
      )}
    </TwView>
  );
}
