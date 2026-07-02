import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

// Tactile feedback shared by Button and PressableScale — one place that maps our intent names to
// expo-haptics impact styles, and swallows the platform rejection on devices without a taptic engine.
export type HapticStyle = 'light' | 'medium' | 'heavy' | false;

const IMPACT: Record<'light' | 'medium' | 'heavy', Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export const triggerHaptic = (style: HapticStyle): void => {
  if (style === false) return;

  Haptics.impactAsync(IMPACT[style]).catch(() => {});
};

// Returns a press handler that fires the haptic first, then runs `onPress` (sync or async), never
// letting a rejected promise escape.
export const useHapticPress = (onPress?: () => void | Promise<void>, haptic: HapticStyle = 'light') =>
  useCallback(() => {
    triggerHaptic(haptic);

    const result = onPress?.();

    if (result instanceof Promise) result.catch(() => {});
  }, [onPress, haptic]);
