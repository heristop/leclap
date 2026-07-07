import { describe, it, expect } from 'vitest';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { STARTER_PRESETS } from '../src/editor/starter-presets';
import { buildDescriptor } from '../src/editor/build-descriptor';

// The save guard mirrored from the web shell: a media scene (music/image) with no library pick and no
// upload can't be saved. Presets must never ship in that state.
const hasUnsaveableMedia = (sections: ReturnType<(typeof STARTER_PRESETS)[number]['build']>['sections']): boolean =>
  sections.some((s) => (s.kind === 'music' || s.kind === 'image') && s.allowed.length === 0 && !s.allowUpload);

describe('STARTER_PRESETS', () => {
  it('exposes unique ids and i18n keys', () => {
    const ids = STARTER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of STARTER_PRESETS) {
      expect(preset.nameKey).toContain(preset.id);
      expect(preset.descriptionKey).toContain(preset.id);
    }
  });

  it('builds fresh, distinct ids each call', () => {
    const a = STARTER_PRESETS[0].build();
    const b = STARTER_PRESETS[0].build();
    expect(a.id).not.toBe(b.id);
  });

  for (const preset of STARTER_PRESETS) {
    it(`"${preset.id}" builds a saveable, schema-valid descriptor`, () => {
      const state = preset.build();

      expect(state.sections.length).toBeGreaterThan(1);
      expect(state.name.trim()).not.toBe('');
      expect(hasUnsaveableMedia(state.sections)).toBe(false);
      // The structural summary shown on picker cards must match what build() actually creates.
      expect(state.sections.map((s) => s.kind)).toEqual(preset.scenes);

      // The real drift guard: the compiled descriptor must satisfy the engine's Zod schema.
      const descriptor = buildDescriptor(state);
      const parsed = TemplateDescriptorSchema.safeParse(descriptor);
      expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 2)).toBe(true);
    });
  }
});
