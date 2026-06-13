import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import type { FramingGuide } from '@/src/types';

interface FramingGuideOverlayProps {
  guide: FramingGuide;
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

// A simple bust silhouette: head (ellipse) + torso/shoulders (smooth path).
// The viewBox is 120×200; the component scales it to fill 70 % of the frame height.
const SilhouetteSvg = ({ opacity }: { opacity: number }) => (
  <Svg
    viewBox="0 0 120 200"
    width="100%"
    height="100%"
    style={{ opacity }}
    accessible={false}
    importantForAccessibility="no"
  >
    {/* Head */}
    <Ellipse cx="60" cy="44" rx="28" ry="32" fill="white" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
    {/* Shoulders / torso — smooth bust shape */}
    <Path
      d="M2 200 C2 145 20 120 60 115 C100 120 118 145 118 200 Z"
      fill="white"
      stroke="rgba(0,0,0,0.35)"
      strokeWidth="2"
    />
  </Svg>
);

export const FramingGuideOverlay = ({ guide }: FramingGuideOverlayProps) => {
  const opacity = guide.opacity ?? 0.35;

  return (
    <View
      style={[styles.container, { justifyContent: JUSTIFY[guide.position] }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.silhouette}>
        <SilhouetteSvg opacity={opacity} />
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
    height: '70%',
    aspectRatio: 120 / 200,
  },
});
