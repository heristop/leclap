import { describe, it, expect } from 'vitest';
import { applyServerMedia } from '../src/applyServerMedia.js';
import type { TemplateDescriptor } from 'ffmpeg-video-composer';

// pictureUrl lives on the schema type but not on the core SectionOptions TS type,
// so image_background descriptors are built loosely and read back through a cast.
type ImageBackgroundOptions = NonNullable<TemplateDescriptor['sections']>[number]['options'] & {
  pictureUrl?: string;
};

function pictureUrlOf(section: NonNullable<TemplateDescriptor['sections']>[number]): string | undefined {
  return (section.options as ImageBackgroundOptions | undefined)?.pictureUrl;
}

describe('applyServerMedia', () => {
  it('sets global.music and enables musicEnabled when musicName is provided', () => {
    const descriptor: TemplateDescriptor = { global: {}, sections: [] };
    applyServerMedia(descriptor, { musicName: 'my_track' });

    expect(descriptor.global?.music).toEqual({ name: 'my_track' });
    expect(descriptor.global?.musicEnabled).toBe(true);
  });

  it('initialises global when the descriptor has none', () => {
    const descriptor: TemplateDescriptor = { sections: [] };
    applyServerMedia(descriptor, { musicName: 'track' });

    expect(descriptor.global?.music).toEqual({ name: 'track' });
  });

  it('sets pictureUrl on every image_background section', () => {
    const descriptor: TemplateDescriptor = {
      sections: [
        { name: 'bg_1', type: 'image_background' },
        { name: 'video_1', type: 'project_video' },
        { name: 'bg_2', type: 'image_background', options: { duration: 3 } },
      ],
    };
    applyServerMedia(descriptor, { backgroundPath: '/tmp/req1/backgrounds/photo.jpg' });

    expect(pictureUrlOf(descriptor.sections![0]!)).toBe('/tmp/req1/backgrounds/photo.jpg');
    expect(pictureUrlOf(descriptor.sections![1]!)).toBeUndefined();
    expect(pictureUrlOf(descriptor.sections![2]!)).toBe('/tmp/req1/backgrounds/photo.jpg');
  });

  it('preserves existing section options when setting pictureUrl', () => {
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 'bg', type: 'image_background', options: { duration: 5 } }],
    };
    applyServerMedia(descriptor, { backgroundPath: '/tmp/bg.png' });

    expect(descriptor.sections![0]!.options?.duration).toBe(5);
    expect(pictureUrlOf(descriptor.sections![0]!)).toBe('/tmp/bg.png');
  });

  it('applies both music and background together', () => {
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 'bg', type: 'image_background' }],
    };
    applyServerMedia(descriptor, { musicName: 'jingle', backgroundPath: '/tmp/hero.jpg' });

    expect(descriptor.global?.music).toEqual({ name: 'jingle' });
    expect(descriptor.global?.musicEnabled).toBe(true);
    expect(pictureUrlOf(descriptor.sections![0]!)).toBe('/tmp/hero.jpg');
  });

  it('is a no-op when neither musicName nor backgroundPath is provided', () => {
    const descriptor: TemplateDescriptor = { global: { music: { name: 'existing' } }, sections: [] };
    applyServerMedia(descriptor, {});

    expect(descriptor.global?.music).toEqual({ name: 'existing' });
    expect(descriptor.global?.musicEnabled).toBeUndefined();
  });

  it('does not touch non-image_background sections for background', () => {
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 'color_bg', type: 'color_background', options: { duration: 2 } }],
    };
    applyServerMedia(descriptor, { backgroundPath: '/tmp/bg.jpg' });

    expect(pictureUrlOf(descriptor.sections![0]!)).toBeUndefined();
  });
});
