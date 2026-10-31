import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CaptureMode } from '@leclap/creative-kit';
import { Icon, type IconName } from '@/src/components/ui/Icon';
import { colors, spacing, typography, withAlpha } from '@/src/styles/theme';

const icons: Record<CaptureMode, IconName> = { front: 'user', back: 'camera', upload: 'upload', screen: 'monitor' };

export function CaptureSourceSelector({
  modes,
  active,
  onChange,
  compact = false,
}: {
  modes: CaptureMode[];
  active: CaptureMode;
  onChange: (mode: CaptureMode) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation('recording');

  if (modes.length < 2) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sources.title')}</Text>
      <View style={styles.track}>
        {modes.map((mode) => {
          const selected = mode === active;

          return (
            <TouchableOpacity
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={t(`sources.${mode}`)}
              accessibilityState={{ selected }}
              style={[styles.segment, compact && styles.compact, selected && styles.selected]}
              onPress={() => {
                if (!selected) onChange(mode);
              }}
            >
              <Icon
                name={icons[mode]}
                size={20}
                color={selected ? colors.primaryLight : colors.monitorSecondary}
                active={selected}
              />
              <Text style={[styles.label, selected && styles.selectedLabel]}>{t(`sources.${mode}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 512, gap: spacing.s },
  title: { ...typography.caption, textAlign: 'center', color: colors.monitorSecondary },
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 6,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.monitorBackground, 0.95),
    borderWidth: 1,
    borderColor: withAlpha(colors.monitorText, 0.15),
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    gap: spacing.xs,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { flexDirection: 'row', minHeight: 48 },
  selected: { backgroundColor: withAlpha(colors.primary, 0.15), borderColor: withAlpha(colors.primaryLight, 0.5) },
  label: { ...typography.button, fontSize: 14, flexShrink: 1, textAlign: 'center', color: colors.monitorSecondary },
  selectedLabel: { color: colors.primaryLight },
});
