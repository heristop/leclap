import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RemotionStoryboardSchema } from '../src/authoring/remotionStoryboard.js';

describe('RemotionStoryboardSchema', () => {
  it('accepts a simple sequence-based storyboard', () => {
    const result = RemotionStoryboardSchema.safeParse({
      title: 'Launch card',
      orientation: 'landscape',
      sequences: [
        {
          id: 'intro',
          duration: 2.5,
          background: { type: 'color', color: '#111111' },
          text: [{ value: 'Launch day', position: 'center', style: 'bold' }],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty sequence lists', () => {
    const result = RemotionStoryboardSchema.safeParse({
      title: 'Empty',
      orientation: 'portrait',
      sequences: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid durations', () => {
    const result = RemotionStoryboardSchema.safeParse({
      title: 'Bad',
      orientation: 'landscape',
      sequences: [{ id: 'bad', duration: 0, background: { type: 'color', color: '#000000' } }],
    });

    expect(result.success).toBe(false);
  });
});
