import { describe, it, expect } from 'vitest';
import { APP_TEMPLATES_BY_ID } from '@leclap/creative-kit';
import { recordingConfigForSection, recordingConfigFromDescriptor } from './recordingConfig';
import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';

const descriptorWithProjectVideo = (overrides: Record<string, unknown> = {}): TemplateDescriptor => ({
  sections: [
    {
      name: 'video_1',
      type: 'project_video',
      options: overrides as never,
    },
  ],
});

describe('recordingConfigFromDescriptor', () => {
  it('returns empty config for null descriptor', () => {
    expect(recordingConfigFromDescriptor(null)).toEqual({
      countdownSeconds: undefined,
      maxDurationSeconds: undefined,
      framingGuide: undefined,
      defaultCaptureMode: 'front',
      allowedCaptureModes: ['front', 'back', 'screen', 'upload'],
      orientation: 'landscape',
    });
  });

  it('returns empty config when no project_video section exists', () => {
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 'intro', type: 'color_background' }],
    };

    expect(recordingConfigFromDescriptor(descriptor)).toEqual({
      countdownSeconds: undefined,
      maxDurationSeconds: undefined,
      framingGuide: undefined,
      defaultCaptureMode: 'front',
      allowedCaptureModes: ['front', 'back', 'screen', 'upload'],
      orientation: 'landscape',
    });
  });

  it('extracts countdownSeconds from countdown + countdownDuration', () => {
    const config = recordingConfigFromDescriptor(descriptorWithProjectVideo({ countdown: true, countdownDuration: 5 }));

    expect(config.countdownSeconds).toBe(5);
  });

  it('defaults countdownSeconds to 4 when countdown is true but no countdownDuration', () => {
    const config = recordingConfigFromDescriptor(descriptorWithProjectVideo({ countdown: true }));

    expect(config.countdownSeconds).toBe(4);
  });

  it('returns undefined countdownSeconds when countdown is false', () => {
    const config = recordingConfigFromDescriptor(
      descriptorWithProjectVideo({ countdown: false, countdownDuration: 5 })
    );

    expect(config.countdownSeconds).toBeUndefined();
  });

  it('extracts maxDurationSeconds from options.duration', () => {
    const config = recordingConfigFromDescriptor(descriptorWithProjectVideo({ duration: 30 }));

    expect(config.maxDurationSeconds).toBe(30);
  });

  it('extracts framingGuide when present', () => {
    const guide = { type: 'silhouette' as const, position: 'right' as const };
    const config = recordingConfigFromDescriptor(descriptorWithProjectVideo({ framingGuide: guide }));

    expect(config.framingGuide).toEqual(guide);
  });

  it('extracts framingGuide with custom opacity', () => {
    const guide = { type: 'silhouette' as const, position: 'center' as const, opacity: 0.5 };
    const config = recordingConfigFromDescriptor(descriptorWithProjectVideo({ framingGuide: guide }));

    expect(config.framingGuide).toEqual(guide);
  });

  it('returns undefined framingGuide when not present', () => {
    const config = recordingConfigFromDescriptor(descriptorWithProjectVideo({ duration: 10 }));

    expect(config.framingGuide).toBeUndefined();
  });

  it('extracts the en description as the recording hint', () => {
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 'video_1', type: 'project_video', description: { en: 'Say your name' } }],
    };

    expect(recordingConfigFromDescriptor(descriptor).description).toBe('Say your name');
  });

  it('falls back to the first description locale when en is absent', () => {
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 'video_1', type: 'project_video', description: { fr: 'Dis ton nom' } }],
    };

    expect(recordingConfigFromDescriptor(descriptor).description).toBe('Dis ton nom');
  });

  it('omits the description key when no section description exists', () => {
    expect(recordingConfigFromDescriptor(descriptorWithProjectVideo({ duration: 10 }))).not.toHaveProperty(
      'description'
    );
  });
});

// Guards the catalog content: the showcase example templates enable the pre-record countdown on
// every clip section, with a 2s lead-in.
describe('example templates enable the recording countdown', () => {
  const everyClipCountsDown = (id: string) => {
    const sections = (APP_TEMPLATES_BY_ID[id]?.descriptor.sections ?? []) as TemplateDescriptor['sections'];
    const clips = (sections ?? []).filter((s) => s.type === 'project_video');

    expect(clips.length).toBeGreaterThan(0);

    for (const clip of clips) {
      expect(recordingConfigForSection(clip).countdownSeconds).toBe(2);
    }
  };

  it('Fast & Curious counts down before every answer clip', () => {
    everyClipCountsDown('fast-curious');
  });

  it('the spotlight counts down before the clip', () => {
    everyClipCountsDown('spotlight');
  });
});
