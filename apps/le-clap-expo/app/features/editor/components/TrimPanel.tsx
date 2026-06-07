import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, type LayoutChangeEvent } from 'react-native';
import { colors, spacing, fonts } from '@/src/styles/theme';

export interface TrimRange {
  start: number;
  end: number;
}

const HANDLE_W = 22;
const MIN_GAP = 0.5; // keep at least 0.5s between handles

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * A dual-handle trim timeline. Dragging a handle reports the new range in seconds and
 * seeks the player so the user previews the exact in/out frame.
 */
export function TrimPanel({
  duration,
  value,
  currentTime,
  onChange,
  onSeek,
}: {
  duration: number;
  value: TrimRange;
  currentTime: number;
  onChange: (next: TrimRange) => void;
  onSeek: (seconds: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const widthRef = useRef(0);
  widthRef.current = trackWidth;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const safeDuration = duration > 0 ? duration : 1;
  const startStart = useRef(value.start);
  const endStart = useRef(value.end);

  const startResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startStart.current = valueRef.current.start;
      },
      onPanResponderMove: (_e, gesture) => {
        if (widthRef.current <= 0) return;
        const dt = (gesture.dx / widthRef.current) * safeDuration;
        const next = clamp(startStart.current + dt, 0, valueRef.current.end - MIN_GAP);
        onChange({ start: next, end: valueRef.current.end });
        onSeek(next);
      },
    })
  ).current;

  const endResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        endStart.current = valueRef.current.end;
      },
      onPanResponderMove: (_e, gesture) => {
        if (widthRef.current <= 0) return;
        const dt = (gesture.dx / widthRef.current) * safeDuration;
        const next = clamp(endStart.current + dt, valueRef.current.start + MIN_GAP, safeDuration);
        onChange({ start: valueRef.current.start, end: next });
        onSeek(next);
      },
    })
  ).current;

  const startX = (value.start / safeDuration) * trackWidth;
  const endX = (value.end / safeDuration) * trackWidth;
  const playX = clamp((currentTime / safeDuration) * trackWidth, 0, trackWidth);

  return (
    <View style={styles.container}>
      <View style={styles.labelsRow}>
        <Text style={styles.timeLabel}>{formatTime(value.start)}</Text>
        <Text style={styles.durationLabel}>{formatTime(value.end - value.start)} selected</Text>
        <Text style={styles.timeLabel}>{formatTime(value.end)}</Text>
      </View>

      <View style={styles.track} onLayout={onTrackLayout}>
        {/* dimmed outside-selection regions */}
        <View style={[styles.dim, { left: 0, width: startX }]} />
        <View style={[styles.dim, { left: endX, right: 0 }]} />

        {/* selected window */}
        <View style={[styles.selected, { left: startX, width: Math.max(0, endX - startX) }]} />

        {/* playhead */}
        {trackWidth > 0 && <View pointerEvents="none" style={[styles.playhead, { left: playX }]} />}

        {/* handles */}
        <View {...startResponder.panHandlers} style={[styles.handle, { left: startX - HANDLE_W / 2 }]}>
          <View style={styles.handleBar} />
        </View>
        <View {...endResponder.panHandlers} style={[styles.handle, { left: endX - HANDLE_W / 2 }]}>
          <View style={styles.handleBar} />
        </View>
      </View>
    </View>
  );
}

const TRACK_H = 56;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  timeLabel: {
    color: colors.surface,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  durationLabel: {
    color: colors.accent,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: TRACK_H,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  dim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },
  selected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 12,
  },
  playhead: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 2,
    backgroundColor: colors.surface,
  },
  handle: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: HANDLE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    width: HANDLE_W,
    height: TRACK_H + 8,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TrimPanel;
