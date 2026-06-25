// Pure: text overlays -> drawtext filters for the descriptor. Shared by the video/color/image
// section builders.
import type { Section } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { findFont } from '../fonts';
import type { TextOverlay } from './model';

type StoredFilter = NonNullable<Section['filters']>[number];

// Clamp a 0–1 position fraction and round to 3 decimals for stable filter expressions.
function roundFraction(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));

  return Math.round(clamped * 1000) / 1000;
}

// A drawtext filter for one overlay. Box keys are only added when the overlay
// opts into a background box; boxcolor carries the author-set opacity suffix.
function drawtextFilterFrom(overlay: TextOverlay): StoredFilter {
  return {
    type: 'drawtext',
    values: {
      text: { en: overlay.text },
      fontsize: overlay.fontsize,
      fontcolor: overlay.fontcolor,
      fontfile: findFont(overlay.font)?.file ?? 'Rubik.ttf',
      x: `(w-text_w)*${roundFraction(overlay.x)}`,
      y: `(h-text_h)*${roundFraction(overlay.y)}`,
      ...(overlay.box ? { box: 1, boxcolor: `${overlay.boxcolor}@${overlay.boxOpacity}`, boxborderw: 12 } : {}),
    },
    // The entrance/exit animations ride as sibling `reveal`/`exit` the engine bakes onto the drawtext;
    // x/y stay the base fractions so the overlay still round-trips through overlayFrom.
    ...(overlay.reveal ? { reveal: overlay.reveal } : {}),
    ...(overlay.exit ? { exit: overlay.exit } : {}),
  };
}

// Non-empty text overlays → drawtext filters, in author order. Shared by video/color/image sections;
// tolerant of an absent list (older states / sections built before overlays existed on this kind).
export function overlayFiltersFrom(overlays: TextOverlay[] | undefined): StoredFilter[] {
  return (overlays ?? []).filter((o) => o.text.trim() !== '').map(drawtextFilterFrom);
}
