import { PromoVideo, type PromoShot } from './PromoVideo';

// The template-builder promo: real /templates/new screen-recordings (apps/leclap-web/scripts/capture-builder.ts).
const SHOTS: readonly PromoShot[] = [
  {
    src: 'pick-background',
    kicker: 'BACKGROUNDS',
    lines: ['Real backgrounds, live.'],
    sub: 'Pick a backdrop — the canvas updates instantly.',
  },
  {
    src: 'canvas-drag',
    kicker: 'WYSIWYG CANVAS',
    lines: ['Drag it into place.'],
    sub: 'Position text and layers right on the frame.',
  },
  {
    src: 'preview-render',
    kicker: 'INSTANT PREVIEW',
    lines: ['Render on-device.'],
    sub: 'A live draft, composed by WebAssembly FFmpeg.',
  },
];

export interface MarketingProps {
  wordmark?: string;
  url?: string;
}

export const Marketing = ({ wordmark = 'LeClap', url = 'Free · in your browser · no sign-up' }: MarketingProps) => (
  <PromoVideo
    shots={SHOTS}
    bumperTagline="THE TEMPLATE BUILDER"
    ctaHeadline="Build your first template — no download."
    addressLabel="leclap · /templates/new"
    wordmark={wordmark}
    url={url}
  />
);
