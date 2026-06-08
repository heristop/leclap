import { buildSingleClipArgs, escapeDrawtext, RESOLUTION } from './ffmpegArgs';

const base = { inputPath: '/in.mp4', outputPath: '/out.mp4' } as const;

describe('escapeDrawtext', () => {
  it('escapes the characters drawtext treats specially', () => {
    expect(escapeDrawtext("a'b:c%d\\e")).toBe("a\\'b\\:c\\%d\\\\e");
  });
});

describe('buildSingleClipArgs', () => {
  it('scales landscape to 1920x1080 with setsar and yuv420p/mpeg4 by default', () => {
    const args = buildSingleClipArgs({ ...base, orientation: 'landscape' });

    expect(args).toEqual([
      '-y',
      '-i',
      '/in.mp4',
      '-vf',
      'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-pix_fmt',
      'yuv420p',
      '-c:v',
      'mpeg4',
      '/out.mp4',
    ]);
  });

  it('uses portrait resolution', () => {
    const args = buildSingleClipArgs({ ...base, orientation: 'portrait' });
    const vf = args[args.indexOf('-vf') + 1];

    expect(RESOLUTION.portrait).toEqual({ w: 1080, h: 1920 });
    expect(vf).toContain('scale=1080:1920');
  });

  it('fast-seeks before -i and caps duration for an explicit trim window', () => {
    const args = buildSingleClipArgs({
      ...base,
      orientation: 'landscape',
      edit: { trimStart: 2, trimEnd: 6.5 },
    });

    // -ss precedes -i
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args[args.indexOf('-ss') + 1]).toBe('2');
    // -t is the window length (6.5 - 2)
    expect(args[args.indexOf('-t') + 1]).toBe('4.5');
  });

  it('falls back to the section duration cap when there is no trim', () => {
    const args = buildSingleClipArgs({ ...base, orientation: 'landscape', durationSec: 8 });

    expect(args).not.toContain('-ss');
    expect(args[args.indexOf('-t') + 1]).toBe('8');
  });

  it('prepends a crop filter before scaling', () => {
    const args = buildSingleClipArgs({
      ...base,
      orientation: 'landscape',
      edit: { crop: { x: 0.1, y: 0.2, w: 0.8, h: 0.6 } },
    });
    const vf = args[args.indexOf('-vf') + 1];

    expect(vf.startsWith('crop=iw*0.8:ih*0.6:iw*0.1:ih*0.2,scale=')).toBe(true);
  });

  it('adds -an when muted', () => {
    const args = buildSingleClipArgs({ ...base, orientation: 'landscape', mute: true });

    expect(args).toContain('-an');
  });

  it('adds a centered, escaped drawtext overlay', () => {
    const args = buildSingleClipArgs({
      ...base,
      orientation: 'portrait',
      drawtext: { text: "Hi O'Hara", fontsize: 48, fontcolor: '#ffffff', fontPath: '/fonts/Rubik.ttf' },
    });
    const vf = args[args.indexOf('-vf') + 1];

    expect(vf).toContain("drawtext=fontfile=/fonts/Rubik.ttf:text='Hi O\\'Hara':fontsize=48:");
    expect(vf).toContain('x=(w-text_w)/2:y=(h-text_h)/2');
  });

  it('honors a custom codec', () => {
    const args = buildSingleClipArgs({ ...base, orientation: 'landscape', codec: 'libx264' });

    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264');
  });
});
