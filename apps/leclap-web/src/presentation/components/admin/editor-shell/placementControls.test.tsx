// @vitest-environment node
// Renders PlacementControls to static markup (no jsdom/RTL in the web app) to assert the canvas-free
// inspector: numeric placement (X/Y/W/H + opacity/rotation) for both kinds, animation source tabs +
// playback for the animation kind, and crucially NO drag canvas (the AnimationFrameCanvas drag-hint
// caption must be absent).
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import type { AnimationOverlay, ImageOverlay } from '../templateEditorModel';
import { PlacementControls } from './placementControls';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

const image: ImageOverlay = {
  id: 'img-1',
  choice: { source: 'library', id: 'sample' },
  position: '10:20',
  scale: '120:80',
};

const animation: AnimationOverlay = {
  id: 'anim-1',
  url: '/assets/animations/confetti.apng',
  position: '10:20',
  scale: '120:80',
};

const renderImage = () =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <PlacementControls kind="image" orientation="landscape" value={image} onChange={noop} />
    </I18nextProvider>
  );

const renderAnimation = () =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <PlacementControls kind="animation" orientation="landscape" value={animation} onChange={noop} />
    </I18nextProvider>
  );

describe('PlacementControls', () => {
  it('image variant: numeric placement, no drag canvas', () => {
    const html = renderImage();

    expect(html).toContain('aria-label="X"');
    expect(html).toContain('aria-label="Y"');
    expect(html).toContain('aria-label="W"');
    expect(html).toContain('aria-label="H"');
    expect(html).toContain(admin.animation.opacity);
    expect(html).toContain(admin.animation.rotation);
    expect(html).not.toContain(admin.animation.dragHint);
  });

  it('animation variant: source tabs + playback, still no drag canvas', () => {
    const html = renderAnimation();

    expect(html).toContain('aria-label="X"');
    expect(html).toContain('aria-label="W"');
    expect(html).toContain(admin.media.tab.library);
    expect(html).toContain(admin.media.tab.upload);
    expect(html).toContain(admin.media.tab.url);
    expect(html).toContain(admin.animation.playback);
    expect(html).not.toContain(admin.animation.dragHint);
  });
});
