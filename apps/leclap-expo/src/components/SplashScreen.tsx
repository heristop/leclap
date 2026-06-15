import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/src/styles/theme';
import logoImage from '@/assets/images/logo.png';

const { width, height } = Dimensions.get('window');
// The tagline is animated letter-by-letter. Hermes (React Native's JS engine) does not
// implement Intl.Segmenter, and converting a string with spread/split conflicts with lint
// rules, so the ASCII characters are listed directly here.
const TAGLINE_LETTERS = [
  'Y',
  'o',
  'u',
  'r',
  ' ',
  's',
  't',
  'o',
  'r',
  'y',
  '.',
  ' ',
  'Y',
  'o',
  'u',
  'r',
  ' ',
  's',
  'c',
  'e',
  'n',
  'e',
  's',
  '.',
  ' ',
  'Y',
  'o',
  'u',
  'r',
  ' ',
  'c',
  'l',
  'a',
  'p',
  '.',
];

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

interface AnimationRefs {
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
  pulseAnim: Animated.Value;
  rotateAnim: Animated.Value;
  taglineOpacity: Animated.Value;
  letterAnimations: Animated.Value[];
}

function buildAnimationSequence(refs: AnimationRefs): Animated.CompositeAnimation {
  const { fadeAnim, scaleAnim, pulseAnim, rotateAnim, taglineOpacity, letterAnimations } = refs;

  return Animated.sequence([
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 10, useNativeDriver: true }),
    ]),
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
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }),
    Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    Animated.stagger(
      30,
      letterAnimations.map((anim) => Animated.timing(anim, { toValue: 1, duration: 50, useNativeDriver: true }))
    ),
    Animated.delay(500),
  ]);
}

function DecorativeBackground({ fadeAnim }: { fadeAnim: Animated.Value }) {
  const makeOpacity = (output: number) => fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, output] });

  return (
    <View style={styles.decorativeContainer}>
      <Animated.View style={[styles.circle1, { opacity: makeOpacity(0.1) }]} />
      <Animated.View style={[styles.circle2, { opacity: makeOpacity(0.08) }]} />
    </View>
  );
}

interface LogoContainerProps {
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
  pulseAnim: Animated.Value;
  rotateInterpolate: Animated.AnimatedInterpolation<string>;
}

function LogoContainer({ fadeAnim, scaleAnim, pulseAnim, rotateInterpolate }: LogoContainerProps) {
  return (
    <Animated.View
      style={[
        styles.logoContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }, { rotate: rotateInterpolate }],
        },
      ]}
    >
      <View style={styles.logoBackground}>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />
      </View>
      <Animated.Text style={[styles.appName, { opacity: fadeAnim }]}>LeClap</Animated.Text>
    </Animated.View>
  );
}

function TaglineView({
  taglineOpacity,
  letterAnimations,
}: {
  taglineOpacity: Animated.Value;
  letterAnimations: Animated.Value[];
}) {
  return (
    <Animated.View style={[styles.taglineContainer, { opacity: taglineOpacity }]}>
      <View style={styles.taglineRow}>
        {TAGLINE_LETTERS.map((letter, index) => (
          <Animated.Text
            key={index}
            style={[
              styles.taglineLetter,
              {
                opacity: letterAnimations[index],
                transform: [
                  { translateY: letterAnimations[index]?.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
    </Animated.View>
  );
}

function FilmStrip({ fadeAnim }: { fadeAnim: Animated.Value }) {
  return (
    <Animated.View
      style={[
        styles.filmStrip,
        {
          opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
        },
      ]}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.filmFrame} />
      ))}
    </Animated.View>
  );
}

export default function AnimatedSplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const letterAnimations = useRef(TAGLINE_LETTERS.map(() => new Animated.Value(0))).current;

  // Keep the latest onAnimationComplete without making it a dependency, so the
  // intro animation runs exactly once on mount instead of restarting from frame 0
  // on every parent re-render (fonts loading, isReady flipping).
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  onAnimationCompleteRef.current = onAnimationComplete;

  const runAnimation = useCallback(() => {
    const sequence = buildAnimationSequence({
      fadeAnim,
      scaleAnim,
      pulseAnim,
      rotateAnim,
      taglineOpacity,
      letterAnimations,
    });
    sequence.start(() => {
      setTimeout(() => {
        onAnimationCompleteRef.current();
      }, 300);
    });
  }, [fadeAnim, scaleAnim, pulseAnim, rotateAnim, taglineOpacity, letterAnimations]);

  useEffect(() => {
    runAnimation();
  }, [runAnimation]);

  const rotateInterpolate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '5deg'] });

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <DecorativeBackground fadeAnim={fadeAnim} />
      <LogoContainer
        fadeAnim={fadeAnim}
        scaleAnim={scaleAnim}
        pulseAnim={pulseAnim}
        rotateInterpolate={rotateInterpolate}
      />
      <TaglineView taglineOpacity={taglineOpacity} letterAnimations={letterAnimations} />
      <FilmStrip fadeAnim={fadeAnim} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  decorativeContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
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
  logoContainer: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  // The logo is a self-contained gradient disc — show it directly with a soft shadow, no white ring.
  logoBackground: {
    width: 168,
    height: 168,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 168,
    height: 168,
    shadowColor: '#1B1740',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
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
  taglineContainer: { position: 'absolute', bottom: height * 0.15, alignItems: 'center' },
  taglineRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: spacing.xl },
  taglineLetter: {
    fontSize: 18,
    color: colors.surface,
    fontWeight: '300',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filmStrip: { position: 'absolute', bottom: 50, flexDirection: 'row', gap: spacing.s },
  filmFrame: {
    width: 40,
    height: 30,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
