import React from 'react';
import { Button as TamaguiButton, Text, XStack } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success';
type ButtonSize = 'small' | 'medium' | 'large' | 'x-large';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  hapticFeedback?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  hapticFeedback = true,
}: ButtonProps) {

  const handlePress = async () => {
    if (disabled || loading) return;

    if (hapticFeedback) {
      await Haptics.impactAsync(
        variant === 'destructive'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light
      );
    }

    onPress?.();
  };

  const getVariantProps = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '$primary',
          borderColor: '$primary',
          hoverStyle: { backgroundColor: '$primaryHover' },
          pressStyle: { backgroundColor: '$primaryPress' },
          focusStyle: { backgroundColor: '$primaryFocus' },
        };
      case 'secondary':
        return {
          backgroundColor: '$secondary',
          borderColor: '$secondary',
          hoverStyle: { backgroundColor: '$secondaryHover' },
          pressStyle: { backgroundColor: '$secondaryPress' },
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: '$borderColor',
          borderWidth: 1,
          hoverStyle: { backgroundColor: '$backgroundHover' },
          pressStyle: { backgroundColor: '$backgroundPress' },
        };
      case 'destructive':
        return {
          backgroundColor: '$error',
          borderColor: '$error',
          hoverStyle: { backgroundColor: '#E53E3E' },
          pressStyle: { backgroundColor: '#C53030' },
        };
      case 'success':
        return {
          backgroundColor: '$success',
          borderColor: '$success',
          hoverStyle: { backgroundColor: '#48BB78' },
          pressStyle: { backgroundColor: '#38A169' },
        };
      default:
        return {};
    }
  };

  const getSizeProps = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: '$m',
          paddingVertical: '$s',
          fontSize: '$3',
          height: 36,
        };
      case 'medium':
        return {
          paddingHorizontal: '$l',
          paddingVertical: '$s',
          fontSize: '$4',
          height: 52,
        };
      case 'large':
        return {
          paddingHorizontal: '$xl',
          paddingVertical: '$s',
          fontSize: '$5',
          height: 62,
        };
      default:
        return {};
    }
  };

  const getTextColor = () => {
    if (disabled) return '$colorTransparent';

    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'destructive':
      case 'success':
        return 'white';
      case 'ghost':
        return '$color';
      default:
        return 'white';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 18;
      case 'large': return 20;
      default: return 18;
    }
  };

  const variantProps = getVariantProps();
  const sizeProps = getSizeProps();
  const textColor = getTextColor();
  const iconSize = getIconSize();

  return (
    <TamaguiButton
      {...variantProps}
      {...sizeProps}
      onPress={handlePress}
      disabled={disabled || loading}
      opacity={disabled ? 0.6 : 1}
      width={fullWidth ? '100%' : 'auto'}
      borderRadius="$3"
      shadowColor="$shadowColor"
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={variant === 'ghost' ? 0 : 0.1}
      shadowRadius={4}
      elevate={variant !== 'ghost'}
      animation="bouncy"
      scale={disabled ? 1 : 0.98}
      hoverStyle={{
        ...variantProps.hoverStyle,
        scale: disabled ? 1 : 1.02,
      }}
      pressStyle={{
        ...variantProps.pressStyle,
        scale: disabled ? 1 : 0.95,
      }}
    >
      <XStack alignItems="center" justifyContent="center" space="$s">
        {/* Loading spinner or left icon */}
        {loading ? (
          <XStack>
            <Ionicons
              name="reload"
              size={iconSize}
              color={textColor === 'white' ? 'white' : textColor === '$color' ? '#212121' : '#757575'}
            />
          </XStack>
        ) : (
          icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={textColor === 'white' ? 'white' : textColor === '$color' ? '#212121' : '#757575'}
            />
          )
        )}

        {/* Button text */}
        {children && (
          <Text
            color={textColor}
            fontSize={sizeProps.fontSize}
            fontWeight="600"
            textAlign="center"
          >
            {typeof children === 'string' ? children : children}
          </Text>
        )}

        {/* Right icon */}
        {!loading && icon && iconPosition === 'right' && (
          <Ionicons
            name={icon}
            size={iconSize}
            color={textColor === 'white' ? 'white' : textColor === '$color' ? '#212121' : '#757575'}
          />
        )}
      </XStack>
    </TamaguiButton>
  );
}
