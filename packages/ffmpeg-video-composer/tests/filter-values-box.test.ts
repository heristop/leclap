import { describe, it, expect } from 'vitest';
import { FilterValuesSchema } from '../src/schemas/filter.schemas';

// The drawtext background-box trio the kit emits (box=1, boxcolor with an @alpha suffix, boxborderw
// padding). Zod's default object strips unknown keys on parse, so the schema must declare them or a
// validated descriptor would silently lose its box.
describe('FilterValuesSchema drawtext box keys', () => {
  it('preserves box, boxcolor and a numeric boxborderw through parse', () => {
    const parsed = FilterValuesSchema.parse({ box: 1, boxcolor: '#000000@0.5', boxborderw: 12 });

    expect(parsed.box).toBe(1);
    expect(parsed.boxcolor).toBe('#000000@0.5');
    expect(parsed.boxborderw).toBe(12);
  });

  it('accepts the FFmpeg n8.0 per-side boxborderw string syntax', () => {
    const parsed = FilterValuesSchema.parse({ box: 1, boxcolor: '#000000', boxborderw: '10|24|10|24' });

    expect(parsed.boxborderw).toBe('10|24|10|24');
  });

  it('keeps every box key optional (box-less drawtext values still parse)', () => {
    const parsed = FilterValuesSchema.parse({ fontcolor: '#ffffff', fontsize: 48 });

    expect(parsed).not.toHaveProperty('box');
    expect(parsed).not.toHaveProperty('boxborderw');
  });
});
