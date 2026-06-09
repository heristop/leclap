import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, spacing, typography } from '@/src/styles/theme';
import * as Leclap from '@/modules/leclap-ffmpeg';

/**
 * On-device engine smoke test. Proves the real `leclap-ffmpeg` native engine (Rust + FFmpeg):
 *  1. `getVersion()` loads the native module (JNA → libleclap_ffmpeg_core.so → dlopen FFmpeg .so).
 *  2. `compile()` runs a real decode → avfilter (scale/pad) → encode → mux on a bundled clip.
 * Reachable via deep link `leclap://ffmpeg-spike`.
 */

const toPath = (uri: string): string => uri.replace('file://', '');

async function resolveSampleClip(): Promise<{ inputPath: string; outUri: string; outPath: string }> {
  const asset = Asset.fromModule(require('../../assets/sample.mp4'));
  await asset.downloadAsync();
  const inputPath = toPath(asset.localUri ?? asset.uri);
  const outUri = `${FileSystem.cacheDirectory}spike-out.mp4`;

  return { inputPath, outUri, outPath: toPath(outUri) };
}

// Run the on-device pipeline (scale/pad + drawtext, a re-entrant 2nd encode, then a music amix) and probe
// the output's video codec ('h264' on success). `append` streams each step's result to the on-screen log.
async function runSpikeSegments(inputPath: string, outPath: string, append: (line: string) => void): Promise<string> {
  const font = `${toPath(FileSystem.cacheDirectory ?? '')}leclap-build/fonts/Rubik.ttf`;
  const draw = `drawtext=text='le-clap':fontfile='${font}':fontsize=48:fontcolor=white:x=40:y=40`;
  const enc = [
    '-c:v',
    'libopenh264',
    '-b:v',
    '4M',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    '-shortest',
  ];

  // seg1: scale/pad + drawtext → real H.264 video.
  const r1 = await Leclap.run([
    '-y',
    '-i',
    inputPath,
    '-vf',
    `setsar=1/1,scale=1280:720,${draw}`,
    ...enc,
    `${outPath}.s1.mp4`,
  ]);
  append(`… seg1 (libopenh264 + drawtext) rc=${r1.code}`);
  // seg2: re-entrant second encode in the same process, different resolution.
  const r2 = await Leclap.run(['-y', '-i', inputPath, '-vf', `scale=640:360,${draw}`, ...enc, `${outPath}.s2.mp4`]);
  append(`… seg2 (re-entrant) rc=${r2.code}`);
  // Music-style amix via filter_complex, muxed with the seg1 H.264 video.
  const r3 = await Leclap.run([
    '-y',
    '-i',
    `${outPath}.s1.mp4`,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex',
    '[0:a][1:a]amix=inputs=2:duration=first[a]',
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    outPath,
  ]);
  append(`… music amix (filter_complex) rc=${r3.code}`);

  // Probe the output: assert it really is an H.264 video stream (proves libopenh264 worked).
  const probe = await Leclap.probe([
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height',
    '-of',
    'default=nk=1:nw=1',
    outPath,
  ]);
  const codec = probe.output.split('\n').filter(Boolean)[0] ?? '?';
  append(`… probe → video codec=${codec}`);
  console.log(
    `LECLAP_WF s1=${r1.code} s2=${r2.code} amix=${r3.code} codec=${codec}\nseg1 log:\n${r1.log.split('\n').filter(Boolean).slice(-6).join('\n')}`
  );

  return codec;
}

export default function FFmpegSpikeScreen() {
  const router = useRouter();
  const [log, setLog] = useState('Tap “Check version” to begin.');
  const [busy, setBusy] = useState(false);
  const [outputUri, setOutputUri] = useState<string | null>(null);

  const player = useVideoPlayer(outputUri, (p) => {
    p.loop = true;
  });

  const append = useCallback((line: string) => {
    setLog((prev) => `${prev}\n${line}`);
  }, []);

  // When deep-linked directly (leclap://ffmpeg-spike) the stack is empty, so router.back()
  // throws "GO_BACK was not handled". Fall back to the app home in that case.
  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }
    router.replace('/');
  }, [router]);

  const checkVersion = useCallback(() => {
    try {
      setLog(`✅ FFmpeg ${Leclap.version()} (native engine loaded)`);
    } catch (error) {
      setLog(`❌ Native engine unavailable.\n${String(error)}`);
    }
  }, []);

  const render = useCallback(async () => {
    setBusy(true);
    setOutputUri(null);
    setLog('Resolving bundled clip…');

    try {
      const { inputPath, outUri, outPath } = await resolveSampleClip();
      append('Compiling on-device (scale → pad → drawtext, libopenh264)…');

      const codec = await runSpikeSegments(inputPath, outPath, append);

      const info = await FileSystem.getInfoAsync(outUri);
      const ok = info.exists && info.size > 0 && codec === 'h264';
      append(
        ok ? `✅ H.264 output ${(info.size / 1024).toFixed(0)} KB — playing below.` : `❌ Bad output (codec=${codec}).`
      );

      if (ok) {
        setOutputUri(outUri);
      }
    } catch (error) {
      append(`❌ ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }, [append]);

  // Auto-run on mount so the on-device smoke test is deterministic.
  useEffect(() => {
    checkVersion();
    const timer = setTimeout(() => {
      render().catch(() => null);
    }, 600);

    return () => {
      clearTimeout(timer);
    };
  }, [checkVersion, render]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.iconBtn} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>On-device engine spike</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.row}>
          <TouchableOpacity testID="spike-version" onPress={checkVersion} style={styles.btn} disabled={busy}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.btnText}>Check version</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="spike-render"
            onPress={() => {
              render().catch(() => {});
            }}
            style={[styles.btn, styles.btnPrimary]}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={18} color="#fff" />}
            <Text style={[styles.btnText, styles.btnTextPrimary]}>Compile clip</Text>
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
  logLabel: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.l,
    marginBottom: spacing.xs,
  },
  logBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.m,
    minHeight: 160,
  },
  logText: { ...typography.caption, color: colors.text, fontFamily: 'System' },
});
