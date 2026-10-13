import React from 'react';
import { ActivityIndicator, type Insets } from 'react-native';
import { TwPressable } from '@/tw';
import { Icon, type GenericIconName } from '@/components/icon';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

export type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'warning';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
  iconName?: GenericIconName;
  icon?: {
    ios?: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  hitSlop?: Insets | number;
}

/**
 * Design system icon-only button component conforming to Sonora architecture conventions.
 * Encapsulates square interactive surfaces with mandatory accessibility labeling.
 */
export function IconButton({
  onPress,
  accessibilityLabel,
  testID,
  iconName,
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  hitSlop,
}: IconButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: {
      button: 'w-8 h-8 rounded-lg',
      iconSize: 16,
    },
    md: {
      button: 'w-10 h-10 rounded-xl',
      iconSize: 20,
    },
    lg: {
      button: 'w-12 h-12 rounded-xl',
      iconSize: 24,
    },
  }[size];

  const variantStyles = {
    primary: {
      button: 'bg-emerald-500 active:bg-emerald-600 shadow-sm border border-transparent',
      iconColor: colors.buttonPrimaryIcon,
      spinnerColor: colors.buttonPrimaryIcon,
    },
    secondary: {
      button:
        'border border-emerald-500/40 dark:border-emerald-400/40 bg-zinc-900/85 dark:bg-zinc-900/85 active:opacity-70 shadow-sm',
      iconColor: colors.buttonSecondaryIcon,
      spinnerColor: colors.buttonSecondaryIcon,
    },
    outline: {
      button: 'border border-border bg-backgroundElement/40 active:opacity-60',
      iconColor: colors.text,
      spinnerColor: colors.text,
    },
    ghost: {
      button: 'bg-transparent active:opacity-60',
      iconColor: colors.textSecondary,
      spinnerColor: colors.textSecondary,
    },
    warning: {
      button: 'bg-amber-600 active:bg-amber-700 shadow-sm border border-transparent',
      iconColor: colors.buttonPrimaryIcon,
      spinnerColor: colors.buttonPrimaryIcon,
    },
  }[variant];

  const renderIcon = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={variantStyles.spinnerColor}
          testID={`${testID}-spinner`}
        />
      );
    }
    if (iconName) {
      return (
        <Icon name={iconName} size={sizeStyles.iconSize} tintColor={variantStyles.iconColor} />
      );
    }
    if (icon) {
      return (
        <Icon
          ios={icon.ios}
          android={icon.android}
          web={icon.web}
          size={sizeStyles.iconSize}
          tintColor={variantStyles.iconColor}
        />
      );
    }
    return null;
  };

  return (
    <TwPressable
      hitSlop={hitSlop ?? (size === 'sm' ? 6 : size === 'md' ? 2 : 0)}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`items-center justify-center overflow-hidden ${
        sizeStyles.button
      } ${variantStyles.button} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {renderIcon()}
    </TwPressable>
  );
}

export default IconButton;
