import React from 'react';
import { ActivityIndicator } from 'react-native';
import { TwPressable } from '@/tw';
import { ThemedText } from '@/components/themed-text';
import { Icon, type GenericIconName } from '@/components/icon';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { SFSymbol, AndroidSymbol } from 'expo-symbols';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconName?: GenericIconName;
  icon?: {
    ios?: SFSymbol;
    android?: AndroidSymbol;
    web?: AndroidSymbol;
  };
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  testID: string;
  accessibilityLabel: string;
}

/**
 * Reusable project button component conforming to Sonora design conventions.
 * Supports primary, secondary, outline, and ghost variants, loading states, and icon integration.
 */
export function Button({
  onPress,
  label,
  variant = 'primary',
  size = 'md',
  iconName,
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const colors = useThemeColors();

  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: {
      button: 'py-2 px-3 gap-1.5',
      text: 'text-xs',
      iconSize: 14,
    },
    md: {
      button: 'py-3 px-4 gap-2',
      text: 'text-sm',
      iconSize: 18,
    },
    lg: {
      button: 'py-3.5 px-5 gap-2.5',
      text: 'text-base',
      iconSize: 20,
    },
  }[size];

  const variantStyles = {
    primary: {
      button: 'bg-emerald-500 active:bg-emerald-600 shadow-sm border border-transparent',
      text: 'text-white font-extrabold',
      iconColor: colors.buttonPrimaryIcon,
      spinnerColor: colors.buttonPrimaryIcon,
    },
    secondary: {
      button:
        'border border-emerald-500/40 dark:border-emerald-400/40 bg-zinc-900/85 dark:bg-zinc-900/85 active:opacity-70 shadow-sm',
      text: 'text-white dark:text-zinc-100 font-semibold',
      iconColor: colors.buttonSecondaryIcon,
      spinnerColor: colors.buttonSecondaryIcon,
    },
    outline: {
      button: 'border border-border bg-backgroundElement/40 active:opacity-60',
      text: 'text-text font-semibold',
      iconColor: colors.text,
      spinnerColor: colors.text,
    },
    ghost: {
      button: 'bg-transparent active:opacity-60',
      text: 'text-textSecondary font-semibold',
      iconColor: colors.textSecondary,
      spinnerColor: colors.textSecondary,
    },
  }[variant];

  const renderIcon = () => {
    if (loading) return null;
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
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`flex-row items-center justify-center rounded-xl overflow-hidden ${
        sizeStyles.button
      } ${variantStyles.button} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.spinnerColor}
          testID={`${testID}-spinner`}
        />
      ) : (
        <>
          {iconPosition === 'left' && renderIcon()}
          <ThemedText className={`${sizeStyles.text} ${variantStyles.text}`}>{label}</ThemedText>
          {iconPosition === 'right' && renderIcon()}
        </>
      )}
    </TwPressable>
  );
}

export default Button;
