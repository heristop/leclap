import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/styles/theme';
import { PressableScale } from '@/src/components/kinetic/pressable-scale';
import { KeyframeDot } from '@/src/features/templates/detail/components/keyframe-dot';
import { styles } from '@/src/features/templates/detail/detail.styles';

interface MediaStepRowProps {
  index: number;
  done: boolean;
  onPress: () => void;
}

const pad = (n: number): string => String(n).padStart(2, '0');

// The music/background step, rendered as the final shot in the filmstrip so it reads as one continuous
// list rather than a special-cased row.
export function MediaStepRow({ index, done, onPress }: MediaStepRowProps) {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.shotRow}>
      <PressableScale style={styles.shotBodyPress} onPress={onPress} accessibilityLabel={t('media.accessibilityLabel')}>
        <View style={styles.rail}>
          <KeyframeDot done={done} />
        </View>
        <View style={styles.shotBody}>
          <View style={styles.shotHeadline}>
            <Text style={styles.shotIndex}>{pad(index)}</Text>
            <Ionicons name="musical-notes" size={15} color={colors.textSecondary} />
            <Text style={styles.shotTitle} numberOfLines={1}>
              {t('media.title')}
            </Text>
          </View>
          <Text style={styles.shotDesc} numberOfLines={1}>
            {done ? t('media.saved') : t('media.description')}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

export default MediaStepRow;
