import { Platform } from 'react-native';
import type { TextProps } from 'react-native';

import { TwText } from '@/tw';

type ThemeColor = 'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
  className?: string;
};

const typeClassMap: Record<string, string> = {
  default: 'text-base font-medium leading-6',
  title: 'text-5xl font-semibold leading-[52px]',
  small: 'text-sm font-medium leading-5',
  smallBold: 'text-sm font-bold leading-5',
  subtitle: 'text-[32px] font-semibold leading-[44px]',
  link: 'text-sm leading-[30px]',
  linkPrimary: 'text-sm leading-[30px] text-link',
  code: `text-xs font-mono ${Platform.OS === 'android' ? 'font-bold' : 'font-medium'}`,
};

const colorClassMap: Record<string, string> = {
  text: 'text-text',
  textSecondary: 'text-textSecondary',
  background: 'text-background',
  backgroundElement: 'text-backgroundElement',
  backgroundSelected: 'text-backgroundSelected',
};

export function ThemedText({ style, type = 'default', themeColor, className, ...rest }: ThemedTextProps) {
  const typeClass = typeClassMap[type] ?? typeClassMap.default;
  const colorClass = themeColor ? (colorClassMap[themeColor] ?? 'text-text') : 'text-text';
  const combined = `${typeClass} ${colorClass}${className ? ` ${className}` : ''}`;
  return <TwText className={combined} style={style} {...rest} />;
}
