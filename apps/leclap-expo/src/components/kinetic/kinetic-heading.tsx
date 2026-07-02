import { View, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { MotiText } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { typography, colors } from '@/src/styles/theme';
import { motion } from '@/src/styles/motion';
import { splitWords, staggerDelay } from '@/src/components/kinetic/split-text.logic';

type DisplayLevel = 'displayHero' | 'displayXl' | 'displayL' | 'displayM' | 'displayS';

interface KineticHeadingProps {
  text: string;
  level?: DisplayLevel;
  color?: string;
  uppercase?: boolean;
  stagger?: number;
  align?: 'left' | 'center';
  style?: StyleProp<TextStyle>;
}

// The oversized Oswald hero type, revealed word-by-word on mount. Each word is its own MotiText so the
// line rises in staggered — the signature "kinetic" entrance. Honours reduced-motion (renders settled).
export function KineticHeading({
  text,
  level = 'displayL',
  color = colors.textStrong,
  uppercase = false,
  stagger = motion.stagger,
  align = 'left',
  style,
}: KineticHeadingProps) {
  const words = splitWords(text);
  const base = typography[level];
  const reduced = useReducedMotion();
  const settled = { opacity: 1, translateY: 0 };
  const gap = base.fontSize * 0.24;

  return (
    <View style={[styles.row, align === 'center' && styles.center]}>
      {words.map((word, index) => (
        <MotiText
          key={`${word}-${index}`}
          from={reduced ? settled : { opacity: 0, translateY: 16 }}
          animate={settled}
          transition={{
            type: 'timing',
            duration: motion.duration.base,
            delay: reduced ? 0 : staggerDelay(index, stagger),
          }}
          style={[base, { color, marginRight: gap }, uppercase && styles.upper, style]}
        >
          {word}
        </MotiText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  center: { justifyContent: 'center' },
  upper: { textTransform: 'uppercase' },
});

export default KineticHeading;
