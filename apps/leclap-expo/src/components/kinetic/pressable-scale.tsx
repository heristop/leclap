import { type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle, type AccessibilityRole } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@/src/styles/motion';
import { useHapticPress, type HapticStyle } from '@/src/hooks/use-haptic-press';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void | Promise<void>;
  scaleTo?: number;
  haptic?: HapticStyle;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { disabled?: boolean; selected?: boolean; checked?: boolean };
  testID?: string;
}

// Tactile tap for anything that isn't a Tamagui Button — cards, tiles, rows, the record button. Dips
// on press with the shared `tap` spring and fires a haptic. The scale lives on the UI thread so it
// stays smooth inside scroll views.
export function PressableScale({
  children,
  onPress,
  scaleTo = 0.96,
  haptic = 'light',
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const handlePress = useHapticPress(onPress, haptic);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        if (disabled) return;

        scale.value = withSpring(scaleTo, motion.spring.tap);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring.tap);
      }}
      onPress={disabled ? undefined : handlePress}
      disabled={disabled}
      style={[style, animatedStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
