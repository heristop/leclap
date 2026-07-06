// The `shape` field on an image input is BUILDER METADATA ONLY: the editor pre-rasterizes the
// shape into the input's PNG data: URL and stores the vector recipe alongside so it can re-hydrate
// the shape controls on import. The engine composites the PNG like any other image input and never
// reads `shape` — but the schema must carry it (zod default "strip" mode would silently drop it on
// any parse-then-store flow) and validate its recipe.
import { describe, it, expect } from 'vitest';
import { InputSchema, ShapeSpecSchema, TemplateDescriptorSchema } from '../src/schemas/section.schemas';

const rectInput = {
  name: 'image_0',
  url: 'data:image/png;base64,AAAA',
  type: 'image',
  shape: { kind: 'rect', color: '#ff4d4d', cornerRadius: 24, strokeWidth: 4, strokeColor: '#ffffff' },
  options: { position: '100:100', scale: '480:480' },
};

describe('image input shape metadata', () => {
  it('parses and PRESERVES a rect shape spec on an image input (not stripped)', () => {
    const parsed = InputSchema.parse(rectInput);

    expect(parsed.shape).toEqual({
      kind: 'rect',
      color: '#ff4d4d',
      cornerRadius: 24,
      strokeWidth: 4,
      strokeColor: '#ffffff',
    });
  });

  it('parses a minimal ellipse spec (kind + color only)', () => {
    const parsed = ShapeSpecSchema.parse({ kind: 'ellipse', color: '#112233' });

    expect(parsed).toEqual({ kind: 'ellipse', color: '#112233' });
  });

  it('keeps plain image inputs valid without a shape (backward compatible)', () => {
    const parsed = InputSchema.parse({ name: 'image_0', url: '/logo.png', type: 'image' });

    expect(parsed.shape).toBeUndefined();
  });

  it('rejects an unknown shape kind and unknown recipe keys', () => {
    expect(ShapeSpecSchema.safeParse({ kind: 'triangle', color: '#000000' }).success).toBe(false);
    expect(ShapeSpecSchema.safeParse({ kind: 'rect', color: '#000000', radius: 3 }).success).toBe(false);
  });

  it('rejects negative cornerRadius / strokeWidth', () => {
    expect(ShapeSpecSchema.safeParse({ kind: 'rect', color: '#000000', cornerRadius: -1 }).success).toBe(false);
    expect(ShapeSpecSchema.safeParse({ kind: 'rect', color: '#000000', strokeWidth: -2 }).success).toBe(false);
  });

  it('survives a full TemplateDescriptorSchema parse on a section input', () => {
    const descriptor = {
      sections: [
        {
          name: 'color_1',
          type: 'color_background',
          options: { duration: 3, backgroundColor: '#101014' },
          inputs: [rectInput],
        },
      ],
    };
    const parsed = TemplateDescriptorSchema.parse(descriptor);

    expect(parsed.sections?.[0]).toMatchObject({ inputs: [{ shape: rectInput.shape }] });
  });
});
