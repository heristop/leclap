import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Ellipse } from 'react-native-svg';
import { DEFAULT_FRAMING_OPACITY } from '@/src/features/templates/model/templateEditorModel';
import type { FramingGuide } from '@/src/types';

interface FramingGuideOverlayProps {
  guide: FramingGuide;
  orientation: 'portrait' | 'landscape';
}

// Horizontal alignment of the silhouette within the frame.
// Position is in screen space — 'left' means left edge of the preview.
// When the front camera mirrors the preview, a subject standing screen-left
// will also see themselves on the left, which is the expected behaviour.
const JUSTIFY: Record<FramingGuide['position'], 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

// A bust silhouette drawn twice: a soft dark halo underneath, then the body on top, so the shape
// stays legible on light/busy feeds (where a plain white washes out) and on dark feeds alike.
// 'bust' fills the body white; 'outline' leaves it hollow with a white stroke. ViewBox 120×200.
const TORSO = 'M2 200 C2 145 20 120 60 115 C100 120 118 145 118 200 Z';

const SilhouetteSvg = ({ opacity, style }: { opacity: number; style: 'bust' | 'outline' }) => {
  const bodyFill = style === 'outline' ? 'none' : 'rgba(255,255,255,0.92)';
  const bodyStrokeWidth = style === 'outline' ? 3 : 1.5;

  return (
    <Svg
      viewBox="0 0 120 200"
      width="100%"
      height="100%"
      style={{ opacity }}
      accessible={false}
      importantForAccessibility="no"
    >
      <G fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="7" strokeLinejoin="round">
        <Ellipse cx="60" cy="44" rx="28" ry="32" />
        <Path d={TORSO} />
      </G>
      <G fill={bodyFill} stroke="white" strokeWidth={bodyStrokeWidth} strokeLinejoin="round">
        <Ellipse cx="60" cy="44" rx="28" ry="32" />
        <Path d={TORSO} />
      </G>
    </Svg>
  );
};

export const FramingGuideOverlay = ({ guide, orientation }: FramingGuideOverlayProps) => {
  const opacity = guide.opacity ?? DEFAULT_FRAMING_OPACITY;
  // A tall portrait frame gets a larger bust; a wide landscape frame a smaller one.
  const height = orientation === 'portrait' ? '74%' : '62%';

  return (
    <View
      style={[styles.container, { justifyContent: JUSTIFY[guide.position] }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.silhouette, { height }]}>
        <SilhouetteSvg opacity={opacity} style={guide.style ?? 'bust'} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 120, // leave space above the record button
    zIndex: 2,
  },
  silhouette: {
    aspectRatio: 120 / 200,
  },
});
