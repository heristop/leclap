import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Image,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../styles/theme';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const letterAnimations = useRef(
    'Your story. Your scenes. Your clap.'.split('').map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Start animation sequence
    const animationSequence = Animated.sequence([
      // Phase 1: Logo fade in and scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 10,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Logo pulse
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),

      // Phase 3: Subtle rotation
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),

      // Phase 4: Tagline typewriter effect
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),

      // Typewriter effect for tagline
      Animated.stagger(
        30,
        letterAnimations.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 50,
            useNativeDriver: true,
          })
        )
      ),

      // Hold for a moment
      Animated.delay(500),
    ]);

    animationSequence.start(() => {
      // Animation complete, trigger the callback after a short delay
      setTimeout(onAnimationComplete, 300);
    });
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '5deg'],
  });

  const tagline = 'Your story. Your scenes. Your clap.';

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Background decorative elements */}
      <View style={styles.decorativeContainer}>
        <Animated.View
          style={[
            styles.circle1,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.1],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.circle2,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.08],
              }),
            },
          ]}
        />
      </View>

      {/* Logo Container */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseAnim) },
              { rotate: rotateInterpolate },
            ],
          },
        ]}
      >
        <View style={styles.logoBackground}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Animated.Text style={[styles.appName, { opacity: fadeAnim }]}>
          LeClap
        </Animated.Text>
      </Animated.View>

      {/* Tagline with typewriter effect */}
      <Animated.View style={[styles.taglineContainer, { opacity: taglineOpacity }]}>
        <View style={styles.taglineRow}>
          {tagline.split('').map((letter, index) => (
            <Animated.Text
              key={index}
              style={[
                styles.taglineLetter,
                {
                  opacity: letterAnimations[index],
                  transform: [
                    {
                      translateY: letterAnimations[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
      </Animated.View>

      {/* Film strip decoration */}
      <Animated.View
        style={[
          styles.filmStrip,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15],
            }),
          },
        ]}
      >
        {[...Array(5)].map((_, i) => (
          <View key={i} style={styles.filmFrame} />
        ))}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  decorativeContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle1: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: colors.accent,
    top: -width * 0.5,
    right: -width * 0.3,
  },
  circle2: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: colors.surface,
    bottom: -width * 0.4,
    left: -width * 0.4,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoBackground: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  logo: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.surface,
    marginTop: spacing.m,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  taglineContainer: {
    position: 'absolute',
    bottom: height * 0.15,
    alignItems: 'center',
  },
  taglineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  taglineLetter: {
    fontSize: 18,
    color: colors.surface,
    fontWeight: '300',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filmStrip: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    gap: spacing.s,
  },
  filmFrame: {
    width: 40,
    height: 30,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});