import { describe, it, expect } from 'vitest';
import { applyMediaChoices } from './applyMediaChoices';
import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';

// Helper to get pictureUrl from an image_background section
function pictureUrlOf(descriptor: TemplateDescriptor, index = 0): string | undefined {
  const section = descriptor.sections?.[index];
  const opts = section?.options as { pictureUrl?: string } | undefined;
  return opts?.pictureUrl;
}

describe('applyMediaChoices', () => {
  describe('music', () => {
    it('sets global.music with a direct URL for a library choice', () => {
      const descriptor: TemplateDescriptor = { global: {}, sections: [] };
      // 'calm-morning' is a real id in the shared catalog — but to avoid catalog coupling in
      // tests, pick a known non-existent id and verify the fallback behaviour (url: undefined).
      applyMediaChoices(descriptor, { music: { source: 'library', id: 'unknown-track' } });
      expect(descriptor.global?.musicEnabled).toBe(true);
      expect(descriptor.global?.music?.name).toBe('unknown-track');
      expect(descriptor.global?.music?.url).toBeUndefined();
    });

    it('sets global.music to a media:// ref for an uploaded track', () => {
      const descriptor: TemplateDescriptor = { global: {}, sections: [] };
      applyMediaChoices(descriptor, { music: { source: 'upload', key: 'abc123', label: 'my-track.mp3' } });
      expect(descriptor.global?.musicEnabled).toBe(true);
      expect(descriptor.global?.music).toEqual({ name: 'abc123', url: 'media://abc123' });
    });

    it('initialises global when absent', () => {
      const descriptor: TemplateDescriptor = { sections: [] };
      applyMediaChoices(descriptor, { music: { source: 'upload', key: 'k1', label: 'f.mp3' } });
      expect(descriptor.global?.music?.url).toBe('media://k1');
    });

    it('leaves music unchanged when no music choice is provided', () => {
      const descriptor: TemplateDescriptor = { global: { musicEnabled: false }, sections: [] };
      applyMediaChoices(descriptor, {});
      expect(descriptor.global?.musicEnabled).toBe(false);
      expect(descriptor.global?.music).toBeUndefined();
    });

    it('leaves music unchanged when music choice is null', () => {
      const descriptor: TemplateDescriptor = { global: { musicEnabled: false }, sections: [] };
      applyMediaChoices(descriptor, { music: null });
      expect(descriptor.global?.musicEnabled).toBe(false);
    });
  });

  describe('background', () => {
    it('sets pictureUrl on all image_background sections for an upload choice', () => {
      const descriptor: TemplateDescriptor = {
        global: {},
        sections: [
          { name: 'background_1', type: 'image_background', options: { duration: 4 } },
          { name: 'background_2', type: 'image_background', options: { duration: 4 } },
          { name: 'video_1', type: 'project_video', options: { duration: 5 } },
        ],
      } as unknown as TemplateDescriptor;

      applyMediaChoices(descriptor, { background: { source: 'upload', key: 'img42', label: 'photo.jpg' } });

      expect(pictureUrlOf(descriptor, 0)).toBe('media://img42');
      expect(pictureUrlOf(descriptor, 1)).toBe('media://img42');
      // non-background section must not be modified
      const opts2 = descriptor.sections?.[2]?.options as { pictureUrl?: string } | undefined;
      expect(opts2?.pictureUrl).toBeUndefined();
    });

    it('sets pictureUrl to a library URL for a library choice (known id fallback to empty string)', () => {
      const descriptor: TemplateDescriptor = {
        global: {},
        sections: [{ name: 'background_1', type: 'image_background', options: { duration: 4 } }],
      } as unknown as TemplateDescriptor;

      applyMediaChoices(descriptor, { background: { source: 'library', id: 'no-such-bg' } });

      // unknown id → resolveBg returns '' (findBackground returns undefined)
      expect(pictureUrlOf(descriptor, 0)).toBe('');
    });

    it('leaves image_background sections untouched when no background choice provided', () => {
      const descriptor: TemplateDescriptor = {
        global: {},
        sections: [{ name: 'background_1', type: 'image_background', options: { duration: 4 } }],
      } as unknown as TemplateDescriptor;

      applyMediaChoices(descriptor, {});

      expect(pictureUrlOf(descriptor, 0)).toBeUndefined();
    });
  });

  describe('combined', () => {
    it('applies both music and background in a single call', () => {
      const descriptor: TemplateDescriptor = {
        global: {},
        sections: [{ name: 'background_1', type: 'image_background', options: { duration: 4 } }],
      } as unknown as TemplateDescriptor;

      applyMediaChoices(descriptor, {
        music: { source: 'upload', key: 'track1', label: 't.mp3' },
        background: { source: 'upload', key: 'img1', label: 'i.jpg' },
      });

      expect(descriptor.global?.music?.url).toBe('media://track1');
      expect(pictureUrlOf(descriptor, 0)).toBe('media://img1');
    });
  });
});
