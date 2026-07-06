import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import AnimationComposer from '@/editor/AnimationComposer';
import { GlobalAnimationSchema } from '@/schemas/global.schemas';
import type { GlobalAnimation } from '@/core/types';

function setup(animations: GlobalAnimation[], opts: { hasAudio?: boolean } = {}) {
  const executed: string[] = [];
  const moves: Array<[string, string]> = [];
  const unlinked: string[] = [];

  const ffmpegAdapter = {
    execute: vi.fn(async (cmd: string) => {
      executed.push(cmd);

      return { rc: 0 };
    }),
    getInfos: vi.fn(async () => ({
      duration: 10,
      videoCodec: 'h264',
      audioCodec: opts.hasAudio === false ? null : 'aac',
      sampleRate: 48000,
    })),
  };

  const filesystemAdapter = {
    getBuildPath: vi.fn(async (dir: string) => `/build/${dir}`),
    getTempDir: vi.fn(() => '/tmp'),
    resolveLocalAsset: vi.fn(async (url: string) => `/build/assets/${url.split('/').at(-1)}`),
    fetch: vi.fn(async (url: string) => `/tmp/dl_${url.split('/').at(-1)}`),
    move: vi.fn(async (src: string, dst: string) => {
      moves.push([src, dst]);
    }),
    unlink: vi.fn(async (path: string) => {
      unlinked.push(path);
    }),
  };

  const project = { config: {}, finalVideo: '/build/output.mp4' };
  const template = { descriptor: { global: { animations } } };
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const variableManager = { mapVariables: (value: string) => value };

  const composer = new AnimationComposer({
    project,
    template,
    logger,
    ffmpegAdapter,
    filesystemAdapter,
    variableManager,
  } as never);

  return { composer, ffmpegAdapter, filesystemAdapter, executed, moves, unlinked };
}

const GLOW = '/assets/animations/glow_border.apng';

describe('AnimationComposer.buildOverlayGraph (fusion params)', () => {
  it('uses a custom base label, input offset and chain prefix without colliding with xfade labels', () => {
    const { composer } = setup([]);
    const staged = [
      { path: '/a.apng', anim: { url: 'a', duration: 6 } },
      { path: '/b.apng', anim: { url: 'b', duration: 6, position: '10:20' } },
    ];

    const graph = composer.buildOverlayGraph(staged as never, {
      baseLabel: '[vfx]',
      firstInputIndex: 4,
      chainPrefix: 'ov',
      outLabel: '[vout]',
    });

    // base is the xfade output; animation inputs start at index 4; chain uses `ov` not `v`.
    expect(graph).toContain('[vfx][4:v]overlay=0:0:eof_action=pass[ov0]');
    expect(graph).toContain('[ov0][5:v]overlay=10:20:eof_action=pass[vout]');
    // must NOT reuse the xfade chain label `[v0]` or hijack `[vout]` mid-chain
    expect(graph).not.toContain('[v0]');
  });

  it('defaults reproduce the standalone graph ([0:v] base, input 1, `v` chain)', () => {
    const { composer } = setup([]);
    const staged = [{ path: '/a.apng', anim: { url: 'a', loop: true } }];

    expect(composer.buildOverlayGraph(staged as never, {})).toBe(
      '[0:v][1:v]overlay=0:0:eof_action=pass:shortest=1[vout]'
    );
  });
});

describe('GlobalAnimationSchema motion', () => {
  it('accepts the motion field the editor emits (bare type and full object)', () => {
    expect(GlobalAnimationSchema.safeParse({ url: GLOW, loop: true, motion: 'fade' }).success).toBe(true);
    expect(
      GlobalAnimationSchema.safeParse({
        url: GLOW,
        loop: true,
        motion: { type: 'rise', delay: 0.2, duration: 0.8, distance: 40, easing: 'ease-out' },
      }).success
    ).toBe(true);
  });

  it('still rejects unknown keys (strict schema)', () => {
    expect(GlobalAnimationSchema.safeParse({ url: GLOW, wobble: true }).success).toBe(false);
  });
});

describe('AnimationComposer.appendAnimations', () => {
  it('no-ops when there are no global animations', async () => {
    const { composer, ffmpegAdapter, moves } = setup([]);

    await composer.appendAnimations('/build/output.mp4');

    expect(ffmpegAdapter.execute).not.toHaveBeenCalled();
    expect(moves).toHaveLength(0);
  });

  it('overlays a single looping animation over the joined video and copies its audio', async () => {
    const { composer, executed, moves, unlinked } = setup([{ url: GLOW, loop: true }]);

    await composer.appendAnimations('/build/output.mp4');

    const cmd = executed[0];
    // the joined video is moved aside to a temp, fed as input 0, and the temp is cleaned up after
    expect(moves[0][0]).toBe('/build/output.mp4');
    const temp = moves[0][1];
    expect(temp).toContain('/tmp/tmp_anim_');
    expect(cmd).toContain(`-i ${temp}`);
    expect(unlinked).toContain(temp);
    // the looped animation source (apng → no codec, -stream_loop -1) staged from the local asset
    expect(cmd).toContain('-stream_loop -1 -i /build/assets/glow_border.apng');
    // one overlay over the base video, bounded to the video via shortest, eof pass (not persistent)
    expect(cmd).toContain('[0:v][1:v]overlay=0:0:eof_action=pass:shortest=1[vout]');
    expect(cmd).toContain('-map "[vout]"');
    expect(cmd).toContain('-map 0:a -c:a copy');
    expect(cmd).toContain('-movflags +faststart');
    expect(cmd).toContain('/build/output.mp4');
  });

  it('applies scale + opacity on the leg and freezes when persistent', async () => {
    const { composer, executed } = setup([
      { url: GLOW, loop: true, persistent: true, scale: '1280:600', opacity: 0.3 },
    ]);

    await composer.appendAnimations('/build/output.mp4');

    const cmd = executed[0];
    expect(cmd).toContain('[1:v]scale=1280:600,setsar=1,format=rgba,colorchannelmixer=aa=0.3[anim0]');
    expect(cmd).toContain('[0:v][anim0]overlay=0:0:eof_action=repeat:shortest=1[vout]');
  });

  it('chains multiple animations, last producing [vout]', async () => {
    const { composer, executed } = setup([
      { url: GLOW, loop: true },
      { url: '/assets/animations/light_leak.apng', loop: true, position: '10:20' },
    ]);

    await composer.appendAnimations('/build/output.mp4');

    const cmd = executed[0];
    expect(cmd).toContain('[0:v][1:v]overlay=0:0:eof_action=pass:shortest=1[v0]');
    expect(cmd).toContain('[v0][2:v]overlay=10:20:eof_action=pass:shortest=1[vout]');
  });

  it('omits the audio map when the joined video has no audio stream', async () => {
    const { composer, executed } = setup([{ url: GLOW, loop: true }], { hasAudio: false });

    await composer.appendAnimations('/build/output.mp4');

    expect(executed[0]).not.toContain('-map 0:a');
  });

  it('bounds a duration overlay with -t and drops shortest (the overlay ends, the video shows through)', async () => {
    const { composer, executed } = setup([{ url: GLOW, duration: 8 }]);

    await composer.appendAnimations('/build/output.mp4');

    const cmd = executed[0];
    expect(cmd).toContain('-stream_loop -1 -t 8 -i /build/assets/glow_border.apng');
    expect(cmd).toContain('[0:v][1:v]overlay=0:0:eof_action=pass[vout]');
    expect(cmd).not.toContain('shortest=1');
  });

  it('lowers a fade motion to an alpha fade-in on the overlay leg (format+fade, both LGPL)', async () => {
    const { composer, executed } = setup([{ url: GLOW, loop: true, motion: 'fade' }]);

    await composer.appendAnimations('/build/output.mp4');

    const cmd = executed[0];
    // the fade rides the overlay LEG (before compositing) so only the overlay fades in, not the video
    expect(cmd).toContain('[1:v]format=rgba,fade=t=in:st=0.3:d=0.6:alpha=1[anim0]');
    expect(cmd).toContain('[0:v][anim0]overlay=0:0:eof_action=pass:shortest=1[vout]');
  });

  it('appends the fade after the existing leg filters, reusing their rgba frame', async () => {
    const { composer, executed } = setup([{ url: GLOW, loop: true, scale: '1280:600', opacity: 0.3, motion: 'fade' }]);

    await composer.appendAnimations('/build/output.mp4');

    // the opacity path already converted to rgba once; the fade must not re-format
    expect(executed[0]).toContain(
      '[1:v]scale=1280:600,setsar=1,format=rgba,colorchannelmixer=aa=0.3,fade=t=in:st=0.3:d=0.6:alpha=1[anim0]'
    );
  });

  it('lowers a rise motion to overlay x/y time expressions easing back to the static position', async () => {
    const { composer, executed } = setup([
      { url: GLOW, loop: true, position: '10:20', motion: { type: 'rise', delay: 0, duration: 1, distance: 40 } },
    ]);

    await composer.appendAnimations('/build/output.mp4');

    expect(executed[0]).toContain(
      "[0:v][1:v]overlay=x='10':y='(20)+(1-(if(lt(t,0),0,if(lt(t,1),(t-0)/1,1))))*40':eof_action=pass:shortest=1[vout]"
    );
  });

  it('keeps the static positional overlay form for motion none', async () => {
    const { composer, executed } = setup([{ url: GLOW, loop: true, position: '10:20', motion: 'none' }]);

    await composer.appendAnimations('/build/output.mp4');

    expect(executed[0]).toContain('[0:v][1:v]overlay=10:20:eof_action=pass:shortest=1[vout]');
  });

  it('caps a finite loop count with the base-video duration ceiling and drops shortest', async () => {
    // the getInfos stub reports a 10s joined video, so finite loops get -t 10 as a safety ceiling
    const { composer, executed } = setup([{ url: GLOW, loops: 3 }]);

    await composer.appendAnimations('/build/output.mp4');

    const cmd = executed[0];
    expect(cmd).toContain('-stream_loop 2 -t 10 -i /build/assets/glow_border.apng');
    expect(cmd).toContain('[0:v][1:v]overlay=0:0:eof_action=pass[vout]');
    expect(cmd).not.toContain('shortest=1');
  });
});
