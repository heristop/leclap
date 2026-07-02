import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { Section, Project } from '@/src/types';
import { resolveTranslation, resolveVariables } from '@/src/utils/i18nText';
import { colors } from '@/src/styles/theme';
import { PressableScale } from '@/src/components/kinetic/pressable-scale';
import { isSectionCompleted } from '@/src/features/templates/detail/section-status';
import { getSectionIcon } from '@/src/features/templates/detail/section-icons';
import { KeyframeDot } from '@/src/features/templates/detail/components/keyframe-dot';
import { styles } from '@/src/features/templates/detail/detail.styles';

interface ShotRowProps {
  section: Section;
  project: Project;
  index: number; // 1-based shot number
  vars: Record<string, string | string[]>;
  onPress: () => void;
  onPreview: () => void;
}

const pad = (n: number): string => String(n).padStart(2, '0');

// One shot in the list: a keyframe status dot on the filmstrip spine, the shot number + interpolated
// title/description, and — for a recorded clip/picture — a monitor "clip loaded" chip that previews it.
export function ShotRow({ section, project, index, vars, onPress, onPreview }: ShotRowProps) {
  const { t, i18n } = useTranslation('detail');
  const completed = isSectionCompleted(section, project);
  const title = resolveVariables(resolveTranslation(section.title, i18n.language) ?? section.name, vars);
  const descriptionText = resolveTranslation(section.description, i18n.language);
  const description = descriptionText ? resolveVariables(descriptionText, vars) : '';
  const hasClip = completed && (section.type === 'project_video' || section.type === 'picture');

  return (
    <View style={styles.shotRow}>
      <PressableScale style={styles.shotBodyPress} onPress={onPress} accessibilityLabel={title}>
        <View style={styles.rail}>
          <KeyframeDot done={completed} />
        </View>
        <View style={styles.shotBody}>
          <View style={styles.shotHeadline}>
            <Text style={styles.shotIndex}>{pad(index)}</Text>
            <Ionicons name={getSectionIcon(section)} size={15} color={colors.textSecondary} />
            <Text style={styles.shotTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {description ? (
            <Text style={styles.shotDesc} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
      </PressableScale>

      {hasClip ? (
        <PressableScale style={styles.thumbChip} onPress={onPreview} accessibilityLabel={t('preview')}>
          <Ionicons name="play" size={18} color={colors.primary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

export default ShotRow;
