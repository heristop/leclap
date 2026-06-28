import { useEffect } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useCompileProgressStore } from '@/src/stores/useCompileProgressStore';
import { colors, fonts, withAlpha } from '@/src/styles/theme';

const logo = require('../../../assets/images/logo.png');

// Ring geometry — the LeClap logo sits at the centre, the progress arc fills around it.
const RING = 188;
const STROKE = 9;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Full-screen, on-device compile experience: a breathing LeClap logo inside an animated progress ring,
 * the live percentage, the engine's playful stage quip, and a "stays on your device" badge over a
 * cinematic gradient. Mounted once at the app root; visible only while a compilation is in flight,
 * driven by `useCompileProgressStore` (fed by the engine's `compilation-progress` events).
 */
export function CompileProgressOverlay() {
  const visible = useCompileProgressStore((s) => s.visible);
  const ratio = useCompileProgressStore((s) => s.ratio);
  const stage = useCompileProgressStore((s) => s.stage);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 360 });
  }, [ratio, progress]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const percent = Math.round(ratio * 100);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => {}}>
      <LinearGradient
        colors={['#0B1020', '#12183A', '#1B2350']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <MotiView
          from={{ opacity: 0, scale: 0.94, translateY: 8 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380 }}
          style={styles.center}
        >
          <Text style={styles.heading}>Creating your video</Text>

          <View style={styles.ringWrap}>
            {/* Soft pulsing halo behind the logo for life. */}
            <MotiView
              from={{ opacity: 0.18, scale: 0.9 }}
              animate={{ opacity: 0.42, scale: 1.18 }}
              transition={{ loop: true, repeatReverse: true, type: 'timing', duration: 1900 }}
              style={styles.halo}
            />

            <Svg width={RING} height={RING} style={styles.ringSvg}>
              <Defs>
                <SvgGradient id="leclapArc" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.primary} />
                  <Stop offset="1" stopColor={colors.secondary} />
                </SvgGradient>
              </Defs>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke="url(#leclapArc)"
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={arcProps}
              />
            </Svg>

            {/* Breathing logo. */}
            <MotiView
              from={{ scale: 0.96 }}
              animate={{ scale: 1.05 }}
              transition={{ loop: true, repeatReverse: true, type: 'timing', duration: 1500 }}
              style={styles.logoWrap}
            >
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </MotiView>
          </View>

          <Text style={styles.percent}>{percent}%</Text>

          <View style={styles.quipSlot}>
            <AnimatePresence exitBeforeEnter>
              <MotiText
                key={stage || 'prep'}
                from={{ opacity: 0, translateY: 7 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: -7 }}
                transition={{ type: 'timing', duration: 280 }}
                style={styles.quip}
              >
                {stage || 'Warming up the projector…'}
              </MotiText>
            </AnimatePresence>
          </View>

          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Rendering privately on your device</Text>
          </View>
        </MotiView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  heading: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    letterSpacing: 0.6,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    marginBottom: 40,
  },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  halo: {
    position: 'absolute',
    width: RING * 0.82,
    height: RING * 0.82,
    borderRadius: RING,
    backgroundColor: withAlpha(colors.primary, 0.45),
  },
  logoWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96 },
  percent: {
    fontFamily: fonts.poppins.bold,
    fontSize: 52,
    letterSpacing: 1,
    color: '#FFFFFF',
    marginTop: 36,
  },
  quipSlot: { height: 26, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  quip: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    letterSpacing: 0.2,
    color: withAlpha('#FFFFFF', 0.72),
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha('#FFFFFF', 0.12),
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  badgeText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12.5,
    letterSpacing: 0.3,
    color: withAlpha('#FFFFFF', 0.66),
  },
});

export default CompileProgressOverlay;
