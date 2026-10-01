import {
  TITLE_EFFECT_ID,
  TITLE_EFFECT_VERSION,
  TITLE_COMPOSITION_ID,
  titlePropsSchema,
  titleAssetsSchema,
} from './title-definition.js';
import {
  PROMO_EFFECT_ID,
  PROMO_EFFECT_VERSION,
  PROMO_COMPOSITION_ID,
  promoPropsSchema,
  promoAssetsSchema,
} from './promo-registry.js';
const images = ['.png', '.jpg', '.jpeg', '.webp'];
const fonts = ['.ttf', '.otf', '.woff', '.woff2'];
const output = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 300,
  durationSeconds: 10,
  orientation: 'landscape',
} as const;
const definitions = [
  {
    id: TITLE_EFFECT_ID,
    version: TITLE_EFFECT_VERSION,
    compositionId: TITLE_COMPOSITION_ID,
    props: titlePropsSchema,
    assets: titleAssetsSchema,
    output,
    assetExtensions: { background: ['.mp4', '.mov', '.webm', '.m4v'], logo: images, font: fonts } as Record<
      string,
      readonly string[]
    >,
    timing: 'logoDelayFrames + entranceDurationFrames must be <= 300.',
    assetRestrictions:
      'Absolute regular local files within mediaDir, realpath-contained. Background video (.mp4/.mov/.webm/.m4v) >=10s; logo .png/.jpg/.jpeg/.webp; font .ttf/.otf/.woff/.woff2. Extra props/assets rejected. No remote scene assets.',
  },
  {
    id: PROMO_EFFECT_ID,
    version: PROMO_EFFECT_VERSION,
    compositionId: PROMO_COMPOSITION_ID,
    props: promoPropsSchema,
    assets: promoAssetsSchema,
    output,
    assetExtensions: { screenshot: images, logo: images, font: fonts } as Record<string, readonly string[]>,
    timing: 'ctaStartFrame - showcaseStartFrame must be >= 90.',
    assetRestrictions:
      'Absolute regular local files within mediaDir, realpath-contained. Screenshot and logo .png/.jpg/.jpeg/.webp; font .ttf/.otf/.woff/.woff2. Extra props/assets rejected. No remote scene assets. displayUrl is text only; never fetched.',
  },
];
export function getEffectDefinition(id: string, version: string) {
  const definition = definitions.find((entry) => entry.id === id && entry.version === version);

  if (!definition) {
    throw new Error(
      `effect_not_registered: ${id}@${version}; supported ${definitions.map((entry) => `${entry.id}@${entry.version}`).join(', ')}.`
    );
  }

  return definition;
}
