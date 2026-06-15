import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RemotionStoryboardSchema } from '../src/authoring/remotionStoryboard.js';
import { storyboardToTemplate } from '../src/authoring/storyboardToTemplate.js';
import { validateTemplate } from '../src/compose/validation.js';

describe('storyboardToTemplate', () => {
  it('converts color sequences into color_background sections', () => {
    const storyboard = RemotionStoryboardSchema.parse({
      title: 'Launch card',
      orientation: 'landscape',
      variables: { name: 'Alex' },
      sequences: [
        {
          id: 'intro',
          duration: 2,
          background: { type: 'color', color: '#111111' },
          text: [{ value: 'Hello {{ name }}', position: 'center', style: 'bold' }],
        },
      ],
    });
    const descriptor = storyboardToTemplate(storyboard);

    expect(descriptor.global?.orientation).toBe('landscape');
    expect(descriptor.global?.variables).toEqual({ name: 'Alex' });
    expect(descriptor.sections?.[0]).toMatchObject({
      name: 'intro',
      type: 'color_background',
      options: { duration: 2, backgroundColor: '#111111' },
      caption: { text: { en: 'Hello {{ name }}' }, position: 'center', style: 'bold' },
    });
    expect(validateTemplate(descriptor).ok).toBe(true);
  });

  it('maps user-provided videos to project_video sections', () => {
    const storyboard = RemotionStoryboardSchema.parse({
      orientation: 'portrait',
      sequences: [
        {
          id: 'clip',
          duration: 5,
          background: { type: 'video', src: 'user clip', userProvided: true },
          text: [],
        },
      ],
    });
    const descriptor = storyboardToTemplate(storyboard);

    expect(descriptor.sections?.[0]).toMatchObject({
      name: 'clip',
      type: 'project_video',
      options: { duration: 5 },
    });
    expect(validateTemplate(descriptor).ok).toBe(true);
  });

  it('drops a transition after the last section to satisfy validation rules', () => {
    const storyboard = RemotionStoryboardSchema.parse({
      orientation: 'landscape',
      sequences: [
        {
          id: 'only',
          duration: 2,
          background: { type: 'color', color: '#000000' },
          transitionAfter: { type: 'fade', duration: 0.4 },
        },
      ],
    });
    const descriptor = storyboardToTemplate(storyboard);

    expect(descriptor.sections?.[0]?.transition).toBeUndefined();
    expect(validateTemplate(descriptor).ok).toBe(true);
  });
});
