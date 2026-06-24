import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import ProjectVideo from '@/editor/segments/ProjectVideoSegment';
import type { SectionOptions } from '@/core/types';

// Build a ProjectVideo segment in isolation (bypassing the DI container) with
// just the fields configure() reads, so we can assert on the assembled command.
function buildProjectVideoSegment(options: SectionOptions) {
  const project: any = {
    config: {
      audioConfig: { channelLayout: 'stereo', sampleRate: 44100 },
      hardwareConfig: { preset: 'medium' },
      videoConfig: { scale: '1280:720' },
    },
    buildInfos: { sourceHasAudio: {} },
  };
  const template: any = { descriptor: { global: {} }, assets: { fonts: {} } };
  const segment: any = {};
  const managers: any = {
    assetManager: {},
    variableManager: {},
    mapManager: {},
    filterManager: {},
    formattersManager: {},
    logger: { info() {}, debug() {} },
    filesystemAdapter: {
      getSource: () => '/tmp/video_1.mp4',
      getDestination: () => '/tmp/out.mp4',
      setSegment() {},
    },
  };

  const seg: any = new ProjectVideo(project, template, segment, managers);
  seg.section = { name: 'main', type: 'project_video', options };
  seg.source = '/tmp/video_1.mp4';
  seg.sources = [];
  seg.destination = '/tmp/out.mp4';
  seg.filters = '';
  seg.hwaccelArg = '';

  return seg;
}

describe('ProjectVideoSegment command assembly', () => {
  it('maps the source audio OPTIONALLY (-map 0:a?) so a video-only upload does not abort', () => {
    // A user-uploaded clip may have no audio track. A bare `-map 0:a` makes
    // FFmpeg abort with "Stream map '0:a' matches no streams"; the optional
    // form `-map 0:a?` keeps the real audio when present and is skipped when absent.
    const seg = buildProjectVideoSegment({ duration: 5 });

    seg.configure();
    const command: string = seg.getCommand();

    expect(command).toContain('-map 0:a?');
    // No bare audio map (a `-map 0:a` not followed by `?`).
    expect(command).not.toMatch(/-map 0:a(?!\?)/);
  });

  it('still emits the input and the output destination', () => {
    const seg = buildProjectVideoSegment({ duration: 5 });

    seg.configure();
    const command: string = seg.getCommand();

    expect(command).toContain('-i /tmp/video_1.mp4');
    expect(command).toContain('/tmp/out.mp4');
  });

  it('appends a silent track when the source clip has no audio (so transition acrossfade has a [k:a])', () => {
    // The director probes the source and records no audio; the segment appends an anullsrc leg as the
    // LAST input and maps it as the audio — the source video stays at input 0 so animation/overlay maps
    // that reference `[0:v]` are unaffected. With no asset inputs the silent leg is input 1.
    const seg = buildProjectVideoSegment({ duration: 5 });
    seg.project.buildInfos = { sourceHasAudio: { main: false } };

    seg.configure();
    const command: string = seg.getCommand();

    expect(command).toContain('anullsrc');
    expect(command).toContain('-map 1:a');
    expect(command).not.toMatch(/-map 0:a\??/); // the source's own audio is not mapped
    expect(seg.videoInputIndex()).toBe(0); // video stays at input 0
  });

  it('does NOT add a silent track when the source has audio (maps the source audio optionally)', () => {
    const seg = buildProjectVideoSegment({ duration: 5 });
    seg.project.buildInfos = { sourceHasAudio: { main: true } };

    seg.configure();
    const command: string = seg.getCommand();

    expect(command).not.toContain('anullsrc');
    expect(command).toContain('-map 0:a?');
  });
});
