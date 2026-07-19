// Rounded caption panels over the existing image-overlay pipeline: the engine generates the rounded-rect
// PNG at COMPILE time from a `panel:w=..,h=..,r=..,c=..,o=..` scheme url (see
// `ffmpeg-video-composer/src/editor/presets/rounded-panel.ts`), so the builder never rasterizes anything
// itself — it only edits the spec and re-serialises the choice's url. Mirrors the shape-element pattern
// (`shape-image.ts`) except the recipe (`PanelSpec`) lives entirely IN the url instead of a sibling
// `shape` field, since the engine — not the builder — is the one reading it back out.
import { buildPanelUrl, parsePanelUrl, type PanelSpec } from '@leclap/creative-kit/editor';
import type { ImageOverlay } from '../templateEditorModel';

// The overlay's rounded-panel spec, or null when this ImageOverlay isn't a panel backdrop (a plain
// picked/uploaded image, or a builder-rasterized shape's data: url).
export function panelSpecOf(overlay: ImageOverlay): PanelSpec | null {
  if (overlay.choice.source !== 'url') return null;

  return parsePanelUrl(overlay.choice.url);
}

// The overlay patch for a spec change: width/height are NEVER touched here — they come from the
// template's layout (the panel's target box), not author input — only radius/color/opacity are ever
// patched from the inspector.
export function regeneratedPanelPatch(spec: PanelSpec, patch: Partial<PanelSpec>): Partial<ImageOverlay> {
  return { choice: { source: 'url', url: buildPanelUrl({ ...spec, ...patch }) } };
}
