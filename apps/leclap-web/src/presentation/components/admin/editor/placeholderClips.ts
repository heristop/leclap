// Browser-only generation of placeholder video clips for the builder's "Preview render": when an
// author has no real footage, each project_video section is fed a short, decodable clip (an
// animated brand-gradient with a "Preview" caption) recorded off a canvas with MediaRecorder. The
// resulting File objects are real video the WASM pipeline can decode — not faked metadata — so the
// compile path is exercised exactly as it is for a genuine upload.
import type { EditorState, EditorSection } from '../templateEditorModel';

// The longest project_video duration in the template (so a single generated clip is long enough for
// any section it maps to). Falls back to a sensible minimum.
function longestProjectVideoDuration(state: EditorState): number {
  const durations = state.sections
    .filter((s): s is Extract<EditorSection, { kind: 'video' }> => s.kind === 'video')
    .map((s) => s.duration);

  return Math.max(2, ...(durations.length > 0 ? durations : [0]));
}

// First MediaRecorder mime type the browser actually supports, preferring mp4 (Safari) then webm.
function pickMimeType(): string | undefined {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const supported = (type: string): boolean =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);

  return candidates.find(supported);
}

interface PaintContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

// One animated frame: a drifting lavender→pink gradient with a centred caption — visually obvious
// as a placeholder so a draft is never mistaken for the final render.
function paintFrame({ ctx, width, height }: PaintContext, t: number): void {
  const shift = (Math.sin(t * 1.2) + 1) / 2;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${250 + shift * 30}, 70%, 62%)`);
  gradient.addColorStop(1, `hsl(${320 - shift * 30}, 75%, 66%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(height / 9)}px system-ui, sans-serif`;
  ctx.fillText('Preview', width / 2, height / 2 - height / 14);
  ctx.font = `${Math.round(height / 18)}px system-ui, sans-serif`;
  ctx.fillText('sample footage', width / 2, height / 2 + height / 12);
}

// Record `seconds` of the animated canvas into a single video File. Resolves with a File whose name
// is `name` so the compile service can key it as video_N.
async function recordCanvasClip(name: string, seconds: number, mimeType: string): Promise<File> {
  const width = 640;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get a 2D canvas context for the preview clip.');

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  const start = performance.now();
  let raf = 0;
  const draw = (): void => {
    paintFrame({ ctx, width, height }, (performance.now() - start) / 1000);
    raf = requestAnimationFrame(draw);
  };

  return new Promise<File>((resolve, reject) => {
    recorder.addEventListener('stop', () => {
      cancelAnimationFrame(raf);

      for (const track of stream.getTracks()) track.stop();

      const blob = new Blob(chunks, { type: mimeType });
      const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      resolve(new File([blob], `${name}.${extension}`, { type: mimeType }));
    });
    recorder.addEventListener('error', () => {
      cancelAnimationFrame(raf);
      reject(new Error('Recording the preview clip failed.'));
    });

    draw();
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, seconds * 1000);
  });
}

// Generate `count` placeholder clips (one per project_video section). Each is long enough for the
// longest project_video duration in the template. Throws a friendly error when MediaRecorder isn't
// available so the caller can surface it instead of compiling with no footage.
export async function generatePlaceholderClips(state: EditorState, count: number): Promise<File[]> {
  if (count === 0) return [];

  const mimeType = pickMimeType();

  if (!mimeType) {
    throw new Error('This browser cannot generate a preview clip (MediaRecorder is unavailable).');
  }

  const seconds = longestProjectVideoDuration(state);

  // Recorded sequentially — concurrent MediaRecorders on separate canvases are flaky across
  // browsers — by chaining each recording onto the previous one's resolution.
  return Array.from({ length: count }).reduce<Promise<File[]>>(
    (chain, _unused, i) =>
      chain.then(async (clips) => [...clips, await recordCanvasClip(`preview_${i + 1}`, seconds, mimeType)]),
    Promise.resolve([])
  );
}
