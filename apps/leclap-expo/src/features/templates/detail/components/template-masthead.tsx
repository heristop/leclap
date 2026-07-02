import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { Orientation } from '@/src/types';
import { colors } from '@/src/styles/theme';
import { ORIENTATION_ICON } from '@/src/features/templates/orientationMeta';
import { KineticHeading } from '@/src/components/kinetic/kinetic-heading';
import { PressableScale } from '@/src/components/kinetic/pressable-scale';
import { styles } from '@/src/features/templates/detail/detail.styles';

interface TemplateMastheadProps {
  title: string;
  description: string;
  orientation: Orientation;
  onBack: () => void;
}

// The editorial masthead: a bare back chevron, a format tag, the template name as the oversized kinetic
// hero, and the interpolated description as a quiet standfirst.
export function TemplateMasthead({ title, description, orientation, onBack }: TemplateMastheadProps) {
  const { t } = useTranslation('detail');

  return (
    <View style={styles.masthead}>
      <View style={styles.mastheadTopRow}>
        <PressableScale style={styles.backChevron} onPress={onBack} accessibilityLabel={t('backToTemplates')}>
          <Ionicons name="chevron-back" size={26} color={colors.textStrong} />
        </PressableScale>
        <View style={styles.formatChip}>
          <Ionicons name={ORIENTATION_ICON[orientation]} size={13} color={colors.primary} />
          <Text style={styles.formatChipText}>{t(`orientation.${orientation}`)}</Text>
        </View>
      </View>

      <View style={styles.mastheadHeading}>
        <KineticHeading text={title} level="displayL" />
      </View>

      {description ? (
        <Text style={styles.standfirst} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export default TemplateMasthead;
