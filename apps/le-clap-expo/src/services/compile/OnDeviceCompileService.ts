import * as FileSystem from 'expo-file-system/legacy';
import type { Section } from '@/src/types';
import type { CompileInput, CompileOptions, CompileResult, CompileService } from './CompileService';
import { buildSingleClipArgs, type ClipEdit, type DrawtextOverlay } from '@/src/services/ffmpeg/ffmpegArgs';
import type * as FFmpegExpo from 'ffmpeg-expo';

/**
 * Serverless, on-device compilation via ffmpeg-expo. Drops in behind {@link CompileService} in
 * place of {@link StubCompileService} once the Phase 0 spike confirms the native module renders.
 *
 * Current scope: the single-clip path (one recorded `project_video`, optional trim/crop/mute and a
 * static text overlay), scaled to the template orientation — see ffmpegArgs.ts. Multi-section
 * concat / transitions / music are a follow-up (a multi-pass pipeline validated incrementally
 * on-device). Anything outside this scope returns a clear, non-throwing failure.
 */

// Lazy require so the module loads even when the native build doesn't include ffmpeg-expo yet.
type FFmpegModule = typeof FFmpegExpo;
const loadFFmpeg = (): FFmpegModule => require('ffmpeg-expo') as FFmpegModule;

// FFmpeg needs a raw filesystem path, not a file:// URI.
const toPath = (uri: string): string => uri.replace('file://', '');
const toUri = (path: string): string => (path.startsWith('file://') ? path : `file://${path}`);

type DrawtextFilter = {
  type: string;
  values?: { text?: Record<string, string>; fontsize?: number | string; fontcolor?: string };
};

function drawtextFrom(section: Section, fontPath: string | undefined): DrawtextOverlay | undefined {
  if (!fontPath) {
    return undefined;
  }

  const dt = ((section.filters ?? []) as DrawtextFilter[]).find((f) => f.type === 'drawtext');
  const en = dt?.values?.text?.en;
  const text = en?.trim();

  if (!text) {
    return undefined;
  }

  return {
    text,
    fontsize: Number(dt?.values?.fontsize ?? 48),
    fontcolor: dt?.values?.fontcolor ?? '#ffffff',
    fontPath,
  };
}

export interface OnDeviceCompileOptions {
  /** Absolute path to a .ttf so drawtext overlays can render; omit to skip overlays. */
  fontPath?: string;
  /** Output video codec; defaults to mpeg4 (proven available in the ffmpeg-expo build). */
  codec?: string;
}

type ClipValue = CompileInput['clips'][string];
type SingleClipPlan = { section: Section; clip: ClipValue } | { error: string };

// Validate the template is the single-clip on-device case and pick the clip to render.
function planSingleClip(input: CompileInput): SingleClipPlan {
  const sections = input.descriptor.sections ?? [];
  const videoSections = sections.filter((s) => s.type === 'project_video');

  if (videoSections.length !== 1 || sections.some((s) => s.type === 'color_background')) {
    return {
      error: 'On-device compile currently supports a single recorded clip. Multi-section templates are coming next.',
    };
  }

  const section = videoSections[0];
  const clip = input.clips[section.name] ?? Object.values(input.clips)[0];

  if (!clip.path) {
    return { error: `No recorded clip found for section "${section.name}".` };
  }

  return { section, clip };
}

// Forward an AbortSignal to the native session; returns a detach callback for the happy path.
function wireAbort(signal: AbortSignal | undefined, session: { cancel: () => Promise<unknown> }): () => void {
  if (!signal) {
    return () => {};
  }

  const onAbort = () => {
    session.cancel().catch(() => {});
  };

  if (signal.aborted) {
    onAbort();
    return () => {};
  }

  signal.addEventListener('abort', onAbort, { once: true });

  return () => {
    signal.removeEventListener('abort', onAbort);
  };
}

export class OnDeviceCompileService implements CompileService {
  constructor(private readonly opts: OnDeviceCompileOptions = {}) {}

  async compile(input: CompileInput, options: CompileOptions = {}): Promise<CompileResult> {
    const plan = planSingleClip(input);

    if ('error' in plan) {
      return { success: false, error: plan.error };
    }

    const { section, clip } = plan;
    const orientation = input.descriptor.global?.orientation ?? clip.orientation;
    const edit: ClipEdit = {
      trimStart: clip.trim?.start,
      trimEnd: clip.trim?.end,
      crop: clip.crop,
    };
    const outputPath = toPath(`${FileSystem.cacheDirectory ?? ''}leclap-output.mp4`);
    const args = buildSingleClipArgs({
      inputPath: toPath(clip.path),
      outputPath,
      orientation,
      mute: Boolean(section.options?.muteSection),
      durationSec: section.options?.duration,
      edit,
      drawtext: drawtextFrom(section, this.opts.fontPath),
      codec: this.opts.codec,
    });

    return this.runSession(args, outputPath, section.options?.duration, options);
  }

  private async runSession(
    args: ReturnType<typeof buildSingleClipArgs>,
    outputPath: string,
    durationSec: number | undefined,
    options: CompileOptions
  ): Promise<CompileResult> {
    const { onProgress, signal } = options;

    try {
      const session = loadFFmpeg().run(args, {
        onProgress: (p) => {
          const total = p.totalDuration ?? (durationSec ?? 0) * 1000;
          const ratio = total > 0 ? Math.min(0.99, p.time / total) : 0;
          onProgress?.({ ratio, stage: 'Rendering' });
        },
      });

      const detach = wireAbort(signal, session);
      const result = await session.result;
      detach();

      if (result.returnCode !== 0) {
        return { success: false, error: `FFmpeg exited with code ${result.returnCode}.` };
      }

      const info = await FileSystem.getInfoAsync(toUri(outputPath));

      if (!info.exists || info.size === 0) {
        return { success: false, error: 'Compilation produced no output file.' };
      }

      onProgress?.({ ratio: 1, stage: 'Done' });

      return { success: true, outputUri: toUri(outputPath) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
