import { describe, it, expect } from 'vitest';
import { FEATURE_CONTROLS } from '../src/editor/control-metadata';
import { templateDescriptorJsonSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { resolveFieldPath } from '../src/editor/schema-walk';

describe('control metadata registry', () => {
  it('every spec fieldPath resolves to a real schema node', () => {
    for (const [feature, specs] of Object.entries(FEATURE_CONTROLS)) {
      for (const spec of specs) {
        expect(
          resolveFieldPath(templateDescriptorJsonSchema, feature, spec.fieldPath),
          `${feature}.${spec.fieldPath}`
        ).toBeTruthy();
      }
    }
  });

  it('enum specs carry the schema enum values verbatim', () => {
    for (const specs of Object.values(FEATURE_CONTROLS)) {
      for (const spec of specs.filter((s) => s.enumValues)) {
        expect(spec.enumValues!.length).toBeGreaterThan(0);
      }
    }
  });

  it('slider specs carry numeric ranges', () => {
    for (const specs of Object.values(FEATURE_CONTROLS)) {
      for (const spec of specs.filter((s) => s.control === 'slider')) {
        expect(spec.min).toBeDefined();
        expect(spec.max).toBeDefined();
      }
    }
  });
});
