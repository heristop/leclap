// Pure, React-free model that flattens a section's visual elements into one ordered, labelled list
// and supports add / remove / reorder across kinds. The unified left panel renders this list and an
// "Add element" menu drives `canAddElement` / `addElement`. No react-i18next here: descriptors carry
// an i18n key (e.g. `element.text`) + params, and the component translates them.
//
// Per-kind array ownership (confirmed against the editor model):
//   - text overlays (`overlays`):    video, color, image
//   - background layers (`layers`):  color only
//   - image overlays (`images`):     video, color, image
//   - animation overlays (`animations`): video, color, image
//
// NOTE: a section-level background image is NOT a per-index array element (image/color sections carry
// a single `color`/picked background, not an `image` ElementRef), so background-image is OUT of scope
// here. AddElementMenu will handle background-image as a section-level toggle separately.
import {
  makeTemplateId,
  newOverlay,
  type EditorSection,
  type TextOverlay,
  type ImageOverlay,
  type AnimationOverlay,
  type BackgroundLayer,
} from '../templateEditorModel';
import { newExtraLayer } from '../editor/layerGeometry';
import type { ElementRef } from './useSectionSelection';

export interface ElementDescriptor {
  ref: ElementRef;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  kind: ElementRef['kind'];
}

type ArrayField = 'layers' | 'overlays' | 'images' | 'animations';

// The array field that backs each ElementRef kind.
const FIELD_FOR_KIND: Record<ElementRef['kind'], ArrayField> = {
  layer: 'layers',
  text: 'overlays',
  image: 'images',
  animation: 'animations',
};

// Which element kinds each section kind owns. The arrays are optional on the model (absent when
// empty), so ownership is keyed by section kind here rather than inferred from a present field.
const OWNED_KINDS: Record<EditorSection['kind'], ReadonlyArray<ElementRef['kind']>> = {
  video: ['text', 'image', 'animation'],
  color: ['layer', 'text', 'image', 'animation'],
  image: ['text', 'image', 'animation'],
  music: [],
  form: [],
  partial: [],
};

// Stable flatten order: background layers, then text overlays, then image overlays, then animations.
const KIND_ORDER: ReadonlyArray<ElementRef['kind']> = ['layer', 'text', 'image', 'animation'];

// The element array a section carries for `kind`, defaulting to [] for an owned-but-absent array.
function sectionArray(section: EditorSection, kind: ElementRef['kind']): unknown[] | undefined {
  if (!OWNED_KINDS[section.kind].includes(kind)) return undefined;

  const value = (section as Record<string, unknown>)[FIELD_FOR_KIND[kind]];

  if (!Array.isArray(value)) return [];

  return value;
}

// True only when the section kind owns the array for `kind`.
export function canAddElement(section: EditorSection, kind: ElementRef['kind']): boolean {
  return OWNED_KINDS[section.kind].includes(kind);
}

function descriptorsFor(section: EditorSection, kind: ElementRef['kind']): ElementDescriptor[] {
  const list = sectionArray(section, kind);

  if (!list) return [];

  return list.map((_, index) => ({
    ref: { kind, index },
    kind,
    labelKey: `element.${kind}`,
    labelParams: { n: index + 1 },
  }));
}

// Flatten a section's elements into the documented order with one descriptor per indexed element.
export function listSectionElements(section: EditorSection): ElementDescriptor[] {
  return KIND_ORDER.flatMap((kind) => descriptorsFor(section, kind));
}

// A fresh default element for `kind`, reusing the model's real factories.
function newElement(kind: ElementRef['kind']): TextOverlay | BackgroundLayer | ImageOverlay | AnimationOverlay {
  if (kind === 'text') return newOverlay();

  if (kind === 'layer') return newExtraLayer();

  if (kind === 'image') return { id: makeTemplateId(), choice: { source: 'url', url: '' } };

  return { id: makeTemplateId(), url: '' };
}

// Append a default element to the matching array; returns the immutable patch + a ref at the new
// last index. Null when the section does not own the array.
export function addElement(
  section: EditorSection,
  kind: ElementRef['kind']
): { patch: Partial<EditorSection>; ref: ElementRef } | null {
  const list = sectionArray(section, kind);

  if (!list) return null;

  const next = [...list, newElement(kind)];
  const field = FIELD_FOR_KIND[kind];

  return {
    patch: { [field]: next } as Partial<EditorSection>,
    ref: { kind, index: list.length },
  };
}

// Drop the referenced index from the matching array. No-op patch when the section lacks the array.
export function removeElement(section: EditorSection, ref: ElementRef): Partial<EditorSection> {
  const list = sectionArray(section, ref.kind);

  if (!list) return {};

  const field = FIELD_FOR_KIND[ref.kind];
  const next = list.filter((_, index) => index !== ref.index);

  return { [field]: next } as Partial<EditorSection>;
}

// Move the referenced element by `delta`, clamped in-bounds (no-op patch at an edge / missing array).
export function reorderElement(section: EditorSection, ref: ElementRef, delta: number): Partial<EditorSection> {
  const list = sectionArray(section, ref.kind);

  if (!list) return {};

  const to = ref.index + delta;

  if (to < 0 || to >= list.length) return {};

  const next = [...list];
  [next[ref.index], next[to]] = [next[to], next[ref.index]];
  const field = FIELD_FOR_KIND[ref.kind];

  return { [field]: next } as Partial<EditorSection>;
}
