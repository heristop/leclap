import { describe, it, expect } from 'vitest';
import { recordingConfigFromDescriptor } from './recordingConfig';
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
