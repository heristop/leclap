import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, spacing, typography } from '@/src/styles/theme';
import type * as FFmpegExpo from 'ffmpeg-expo';

/**
 * Phase 0 spike: proves on-device FFmpeg (ffmpeg-expo) works WITHOUT a server.
 *
 * This screen is intentionally self-contained — the "render" uses FFmpeg's `lavfi`
 * test source, so it needs no input file. It only works after the native dev client
 * has been rebuilt with the ffmpeg-expo config plugin (`expo prebuild && expo run:android`);
 * before that, the native module is absent and the screen reports it cleanly.
 *
 * Reachable via deep link: `leclap://ffmpeg-spike`.
 */

// Lazy require so this screen renders even when the native module isn't in the build yet.
type FFmpegModule = typeof FFmpegExpo;
const loadFFmpeg = (): FFmpegModule => require('ffmpeg-expo') as FFmpegModule;

// FFmpeg needs a raw filesystem path, not a file:// URI.
const toPath = (uri: string): string => uri.replace('file://', '');

export default function FFmpegSpikeScreen() {
  const router = useRouter();
  const [log, setLog] = useState<string>('Tap “Check version” to begin.');
  const [busy, setBusy] = useState(false);
  const [outputUri, setOutputUri] = useState<string | null>(null);

  const player = useVideoPlayer(outputUri, (p) => { p.loop = true; });

  const append = (line: string) => { setLog((prev) => `${prev}\n${line}`); };

  const checkVersion = () => {
    try {
      const v = loadFFmpeg().getVersion();
      setLog(`✅ FFmpeg ${v.version} (native module loaded)`);
    } catch (error) {
      setLog(`❌ Native module unavailable — rebuild the dev client.\n${String(error)}`);
    }
  };

  const renderTestClip = async () => {
    setBusy(true);
    setOutputUri(null);
    setLog('Rendering a 2s test clip on-device…');

    try {
      const { execute } = loadFFmpeg();
      const outUri = `${FileSystem.cacheDirectory}ffmpeg-spike.mp4`;
      const out = toPath(outUri);

      const result = await execute(
        [
          '-y',
          '-f', 'lavfi',
          '-i', 'testsrc=duration=2:size=480x270:rate=24',
          '-pix_fmt', 'yuv420p',
          '-c:v', 'mpeg4',
          out,
        ],
        { onProgress: (p) => { append(`… ${p.speed.toFixed(2)}x, frame ${p.frame ?? 0}`); } }
      );

      const info = await FileSystem.getInfoAsync(outUri);
      const size = info.exists ? info.size : 0;
      append(`exit=${result.returnCode} in ${result.duration}ms · output ${(size / 1024).toFixed(0)} KB`);

      const ok = result.returnCode === 0 && size > 0;

      if (ok) {
        setOutputUri(outUri);
      }

      append(ok ? '✅ On-device render succeeded — playing below.' : '❌ Render produced no output. See log above.');
    } catch (error) {
      append(`❌ ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { router.back(); }} style={styles.iconBtn} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FFmpeg on-device spike</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.row}>
          <TouchableOpacity testID="spike-version" onPress={checkVersion} style={styles.btn} disabled={busy}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.btnText}>Check version</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="spike-render" onPress={() => { renderTestClip().catch(() => undefined); }} style={[styles.btn, styles.btnPrimary]} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={18} color="#fff" />}
            <Text style={[styles.btnText, styles.btnTextPrimary]}>Render test clip</Text>
          </TouchableOpacity>
        </View>

        {outputUri && (
          <VideoView testID="spike-video" player={player} style={styles.video} contentFit="contain" nativeControls />
        )}

        <Text style={styles.logLabel}>Log</Text>
        <View style={styles.logBox}>
          <Text style={styles.logText}>{log}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.xl,
    paddingBottom: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { ...typography.subtitle, color: colors.text },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.m },
  row: { flexDirection: 'row', gap: spacing.s },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.m,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,131,253,0.08)',
  },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnText: { ...typography.button, color: colors.primary },
  btnTextPrimary: { color: '#fff' },
  video: { width: '100%', height: 200, marginTop: spacing.m, borderRadius: 12, backgroundColor: '#000' },
  logLabel: { ...typography.smallText, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.l, marginBottom: spacing.xs },
  logBox: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, padding: spacing.m, minHeight: 160 },
  logText: { ...typography.caption, color: colors.text, fontFamily: 'System' },
});
