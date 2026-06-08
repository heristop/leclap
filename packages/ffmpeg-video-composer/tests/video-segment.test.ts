import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import Video from '@/editor/segments/VideoSegment';
import type { SectionOptions } from '@/core/types';

// Build a Video segment in isolation (bypassing the DI container) with just the
// fields configure() reads, so we can assert on the assembled FFmpeg command.
function buildVideoSegment(options: SectionOptions) {
  const project: any = {
    config: {
      audioConfig: { channelLayout: 'stereo', sampleRate: 44100 },
      hardwareConfig: { preset: 'medium' },
      videoConfig: { scale: '1280:720' },
    },
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

  const seg: any = new Video(project, template, segment, managers);
  seg.section = { name: 'main', type: 'video', options };
  seg.source = '/tmp/video_1.mp4';
  seg.sources = [];
  seg.destination = '/tmp/out.mp4';
  seg.filters = '';
  seg.hwaccelArg = '';

  return seg;
}

describe('VideoSegment command assembly', () => {
  it('emits a command with input and output for an uploaded video section (no videoUrl/useVideoSection)', () => {
    const seg = buildVideoSegment({ duration: 5 });

    seg.configure();
    const command: string = seg.getCommand();

    // A video segment driven by an uploaded/primary source must still produce a
    // complete command: an input (-i <source>) AND an output file (destination).
    expect(command).toContain('-i /tmp/video_1.mp4');
    expect(command).toContain('/tmp/out.mp4');
  });
});
