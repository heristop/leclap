import { Animated, Easing } from 'react-native';

/**
 * Utility functions for animations
 */

/**
 * Animates a scale effect (pressing)
 * @param {Animated.Value} scaleValue - The animated value to manipulate
 * @param {boolean} pressed - Whether the element is pressed
 */
export const animatePress = (scaleValue: Animated.Value, pressed: boolean): void => {
  Animated.spring(scaleValue, {
    toValue: pressed ? 0.96 : 1,
    friction: 8,
    tension: 80,
    useNativeDriver: true,
  }).start();
};

/**
 * Creates a fade-in animation
 * @param {Animated.Value} opacityValue - The animated value to manipulate
 * @param {number} duration - The duration of the animation in ms
 * @param {function} callback - Function to call when animation completes
 */
export const fadeIn = (opacityValue: Animated.Value, duration: number = 300, callback?: () => void): void => {
  Animated.timing(opacityValue, {
    toValue: 1,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
  }).start(callback ? callback : undefined);
};

/**
 * Creates a fade-out animation
 * @param {Animated.Value} opacityValue - The animated value to manipulate
 * @param {number} duration - The duration of the animation in ms
 * @param {function} callback - Function to call when animation completes
 */
export const fadeOut = (opacityValue: Animated.Value, duration: number = 300, callback?: () => void): void => {
  Animated.timing(opacityValue, {
    toValue: 0,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
  }).start(callback ? callback : undefined);
};

/**
 * Creates a slide-in animation from bottom
 * @param {Animated.Value} translateYValue - The animated value to manipulate
 * @param {number} initialOffset - Initial Y offset
 * @param {number} duration - The duration of the animation in ms
 * @param {function} callback - Function to call when animation completes
 */
export const slideInFromBottom = (
  translateYValue: Animated.Value,
  initialOffset: number = 100,
  duration: number = 300,
  callback?: () => void
): void => {
  Animated.timing(translateYValue, {
    toValue: 0,
    duration,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  }).start(callback ? callback : undefined);
};

/**
 * Creates a staggered animation for lists
 * @param {Animated.Value[]} animations - Array of animated values
 * @param {number} staggerDelay - Delay between each animation
 * @param {number} duration - The duration of each animation
 */
export const staggerAnimations = (
  animations: Animated.Value[],
  staggerDelay: number = 50,
  duration: number = 300
): void => {
  const animationSequence = animations.map((anim, i) => {
    return Animated.timing(anim, {
      toValue: 1,
      duration,
      delay: i * staggerDelay,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    });
  });

  Animated.stagger(staggerDelay, animationSequence).start();
};

const AnimationsExport = {
  name: 'Animations',
};
export default AnimationsExport;
