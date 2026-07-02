import { useMemo, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { colors, withAlpha } from '@/src/styles/theme';
import { holeOffsets } from '@/src/components/kinetic/filmstrip-edge.logic';

interface FilmstripEdgeProps {
  holeSpacing?: number;
  width?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// The vertical film-spine that threads the shot list together — a hairline rail dotted with sprocket
// perforations. Status keyframe dots sit on this rail, so the whole column reads as a strip of film /
// an edit timeline. Measures its own height and lays the holes out evenly (memoized).
export function FilmstripEdge({ holeSpacing = 22, width = 14, color = colors.primary, style }: FilmstripEdgeProps) {
  const [height, setHeight] = useState(0);
  const offsets = useMemo(() => holeOffsets(height, holeSpacing, holeSpacing / 2), [height, holeSpacing]);

  const onLayout = (e: LayoutChangeEvent) => {
    setHeight(e.nativeEvent.layout.height);
  };

  return (
    <View style={[{ width }, styles.edge, style]} onLayout={onLayout}>
      <View style={[styles.rail, { backgroundColor: withAlpha(color, 0.22) }]} />
      {offsets.map((y) => (
        <View key={y} style={[styles.hole, { top: y - 3, backgroundColor: withAlpha(color, 0.45) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { alignItems: 'center' },
  rail: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2 },
  hole: { position: 'absolute', width: 6, height: 6, borderRadius: 2 },
});

export default FilmstripEdge;
