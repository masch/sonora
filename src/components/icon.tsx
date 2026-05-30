import { SymbolView } from 'expo-symbols';
import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

type IconProps = {
  ios: SFSymbol;
  android?: AndroidSymbol;
  web?: AndroidSymbol;
  size?: number;
  tintColor?: string;
};

export function Icon({ ios, android, web, size = 24, tintColor }: IconProps) {
  return <SymbolView name={{ ios, android, web }} size={size} tintColor={tintColor} />;
}
