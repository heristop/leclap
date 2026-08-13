import { PromoVideo, type PromoShot } from './PromoVideo';

// The LinkedIn launch cut: the same three beats the launch post argues, in the order it argues them —
// nothing is uploaded, the browser is a real edit bay, the render happens locally. Rendered at 4:5
// (1080x1350), which takes the most vertical feed space LinkedIn allows without cropping, and carries
// its captions on screen because feed video autoplays muted.
const SHOTS: readonly PromoShot[] = [
  {
    src: 'studio-compose',
    kicker: 'NO UPLOAD',
    lines: ['Nothing leaves', 'your device.'],
    sub: 'Pick a template, drop in a clip.',
  },
  {
    src: 'canvas-drag',
    kicker: 'A REAL EDIT BAY',
    lines: ['Drag it into place.'],
    sub: 'Scenes, text and backgrounds on the canvas.',
  },
  {
    src: 'preview-render',
    kicker: 'RENDERED LOCALLY',
    lines: ['FFmpeg, in your tab.'],
    sub: 'WebAssembly on the web. Rust on iOS and Android.',
  },
];

export interface LinkedinProps {
  wordmark?: string;
  url?: string;
}

export const Linkedin = ({ wordmark = 'LeClap', url = 'leclap.dev' }: LinkedinProps) => (
  <PromoVideo
    shots={SHOTS}
    bumperTagline="ON-DEVICE VIDEO"
    ctaHeadline="Open source, MIT. No signup."
    addressLabel="leclap · /studio"
    wordmark={wordmark}
    url={url}
    // 4:5 is squarer than the other cuts, so the frame comes up to meet the caption.
    frameTopRatio={0.33}
  />
);
