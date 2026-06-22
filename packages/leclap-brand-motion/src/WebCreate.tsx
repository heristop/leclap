import { PromoVideo, type PromoShot } from './PromoVideo';

// The web video-creation promo: real /studio screen-recordings of picking a template, dropping in a
// clip, and rendering — produced by apps/leclap-web/scripts/capture-studio.ts.
const SHOTS: readonly PromoShot[] = [
  {
    src: 'studio-gallery',
    kicker: 'START IN THE BROWSER',
    lines: ['Pick a template.'],
    sub: 'A gallery of ready-made looks — choose one to start.',
  },
  {
    src: 'studio-compose',
    kicker: 'ADD YOUR CLIP',
    lines: ['Drop in your video.'],
    sub: 'Record or upload — your footage lands in the template.',
  },
  {
    src: 'studio-result',
    kicker: 'RENDERED IN-BROWSER',
    lines: ['Your video, ready.'],
    sub: 'Composed by WebAssembly FFmpeg — download & share.',
  },
];

export interface WebCreateProps {
  wordmark?: string;
  url?: string;
}

export const WebCreate = ({ wordmark = 'LeClap', url = 'Free · in your browser · no sign-up' }: WebCreateProps) => (
  <PromoVideo
    shots={SHOTS}
    bumperTagline="MAKE A VIDEO"
    ctaHeadline="Make your first video — free."
    addressLabel="leclap · /studio"
    wordmark={wordmark}
    url={url}
  />
);
