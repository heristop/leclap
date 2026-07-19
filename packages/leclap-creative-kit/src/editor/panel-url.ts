// ---------------------------------------------------------------------------
// `panel:` overlay URL builder — the creative-kit-side half of the rounded caption panel feature.
// ---------------------------------------------------------------------------
//
// The engine (`ffmpeg-video-composer/src/editor/presets/rounded-panel.ts`) owns parsing a `panel:` URL
// into a `PanelSpec` and rendering that spec to a PNG at compile time; it has no need to go the other
// way. Both apps' builders DO need to go the other way — the inspector edits a spec and must serialise
// it back to the URL the descriptor stores. That's `buildPanelUrl` here, plus a re-export of the
// engine's `parsePanelUrl`/`PanelSpec` so importers only need one module for the round trip.
import { parsePanelUrl, type PanelSpec } from 'ffmpeg-video-composer/src/editor/presets/rounded-panel.ts';

export { parsePanelUrl, type PanelSpec };

// Mirrors the engine's private defaults (rounded-panel.ts: DEFAULT_RADIUS / DEFAULT_COLOR /
// DEFAULT_OPACITY) so the builder can omit a param that would round-trip to the same value anyway —
// shortest stable URL form. Not load-bearing for correctness: parsePanelUrl falls back to the same
// values on a missing key, so a drifted constant here only means a slightly longer URL, never a
// wrong one.
const DEFAULT_RADIUS = 24;
const DEFAULT_COLOR = '0a0f14';
const DEFAULT_OPACITY = 0.72;

/**
 * Serialises a `PanelSpec` back into a `panel:` overlay URL, e.g. `panel:w=380,h=150,r=28,c=0a0f14,o=0.72`.
 * `width`/`height` are always required and always emitted; `radius`/`color`/`opacity` are omitted when
 * they equal the engine's defaults so an unmodified panel keeps the shortest possible URL. Round-trips
 * through `parsePanelUrl` for any spec `parsePanelUrl` itself could have produced (radius already
 * clamped to the panel's own half-min-edge, opacity in 0..1, color a lowercase 6-hex string).
 */
export function buildPanelUrl(spec: PanelSpec): string {
  const parts = [`w=${spec.width}`, `h=${spec.height}`];

  if (spec.radius !== DEFAULT_RADIUS) {
    parts.push(`r=${spec.radius}`);
  }

  if (spec.color !== DEFAULT_COLOR) {
    parts.push(`c=${spec.color}`);
  }

  if (spec.opacity !== DEFAULT_OPACITY) {
    parts.push(`o=${spec.opacity}`);
  }

  return `panel:${parts.join(',')}`;
}
