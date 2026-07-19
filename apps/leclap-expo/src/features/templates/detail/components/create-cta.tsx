import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { QualityTier } from 'ffmpeg-video-composer/src/core/encoding.ts';
import { gradients, gradientDir } from '@/src/styles/gradients';
import { PressableScale } from '@/src/components/kinetic/pressable-scale';
import { Segmented } from '@/src/features/templates/components/EditorControls';
import { getButtonLabel } from '@/src/features/templates/detail/button-label';
import { styles } from '@/src/features/templates/detail/detail.styles';

const QUALITY_TIERS: QualityTier[] = ['draft', 'standard', 'high'];

interface CreateCtaProps {
  isDisabled: boolean;
  isPending: boolean;
  willQueue: boolean;
  shotsLeft: number;
  qualityTier: QualityTier;
  onQualityTierChange: (tier: QualityTier) => void;
  onCompile: () => void;
}

// The flow's climactic control: a full-width lavender→pink gradient button with a ▶ render glyph and
// the morphing label, with a draft/standard/high quality picker riding above it. Disabled collapses to
// a flat muted lavender with a "N shots left" helper so the gate teaches rather than just greys out.
export function CreateCta({
  isDisabled,
  isPending,
  willQueue,
  shotsLeft,
  qualityTier,
  onQualityTierChange,
  onCompile,
}: CreateCtaProps) {
  const { t } = useTranslation('detail');
  const label = getButtonLabel(isPending, willQueue, t);

  return (
    <View style={styles.footer}>
      <View style={styles.qualityRow}>
        <Segmented
          label={t('quality.label')}
          value={qualityTier}
          onChange={onQualityTierChange}
          options={QUALITY_TIERS.map((tier) => ({ value: tier, label: t(`quality.${tier}`) }))}
        />
      </View>
      <PressableScale
        style={[styles.cta, isDisabled && styles.ctaDisabled]}
        onPress={onCompile}
        disabled={isDisabled}
        haptic="medium"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {isDisabled ? null : (
          <LinearGradient colors={[...gradients.brand]} {...gradientDir.horizontal} style={StyleSheet.absoluteFill} />
        )}
        {isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="play" size={18} color="#FFFFFF" />
        )}
        <Text style={styles.ctaText}>{label}</Text>
      </PressableScale>

      {isDisabled && !isPending && shotsLeft > 0 ? (
        <Text style={styles.ctaHelper}>{t('shotsLeft', { count: shotsLeft })}</Text>
      ) : null}
    </View>
  );
}

export default CreateCta;
