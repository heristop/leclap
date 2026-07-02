import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GradientMeter } from '@/src/components/kinetic/gradient-meter';
import { styles } from '@/src/features/templates/detail/detail.styles';

interface ProgramStatusStripProps {
  totalDone: number;
  totalItems: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

// The playhead-style progress vocabulary: a gradient meter + an editorial `03/05` fraction. The old
// "3 of 5 sections complete" sentence survives as the accessibility label.
export function ProgramStatusStrip({ totalDone, totalItems }: ProgramStatusStripProps) {
  const { t } = useTranslation('detail');
  const progress = totalItems > 0 ? totalDone / totalItems : 0;
  const complete = totalDone >= totalItems;

  return (
    <View style={styles.statusRow} accessibilityLabel={t('progress', { done: totalDone, total: totalItems })}>
      <GradientMeter progress={progress} variant="playhead" size={6} style={styles.statusMeter} />
      <Text style={[styles.statusFraction, !complete && styles.statusFractionMuted]}>
        {pad(totalDone)}/{pad(totalItems)}
      </Text>
    </View>
  );
}

export default ProgramStatusStrip;
