// @vitest-environment node
// Renders PlacementControls to static markup (no jsdom/RTL in the web app) to assert the canvas-free
// inspector: the collapsed "Placement" disclosure carrying the live numeric summary for both kinds,
// animation source tabs + playback for the animation kind, and crucially NO drag canvas (the
// AnimationFrameCanvas drag-hint caption must be absent). placementSummary is unit-tested directly.
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n, { type TFunction } from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import type { AnimationOverlay, ImageOverlay } from '../templateEditorModel';
import { PlacementControls, placementSummary } from './placementControls';

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

const shape: ImageOverlay = {
  id: 'shape-1',
  choice: { source: 'url', url: 'data:image/png;base64,AAAA' },
  position: '10:20',
  scale: '120:80',
  shape: { kind: 'rect', color: '#ff4d4d', strokeWidth: 4, strokeColor: '#ffffff' },
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
  it('image variant: placement disclosure with a live summary, no drag canvas', () => {
    const html = renderImage();

    // The numeric fields sit inside the collapsed disclosure; the header summary carries the values.
    expect(html).toContain(admin.animation.placementGroup);
    expect(html).toContain('10:20 · 120×80');
    expect(html).not.toContain(admin.animation.dragHint);
  });

  it('shape image: shape controls replace the media picker, placement stays', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <PlacementControls kind="image" orientation="landscape" value={shape} onChange={noop} />
      </I18nextProvider>
    );

    expect(html).toContain(admin.shape.rect);
    expect(html).toContain(admin.shape.ellipse);
    expect(html).toContain(admin.shape.fill);
    expect(html).toContain(admin.shape.cornerRadius);
    expect(html).toContain(admin.shape.stroke);
    expect(html).toContain(admin.shape.strokeColor);
    // Placement stays; the media source picker is gone (a shape has no source to pick).
    expect(html).toContain(admin.animation.placementGroup);
    expect(html).not.toContain(admin.media.tab.library);
  });

  it('plain image keeps the media picker and shows no shape controls', () => {
    const html = renderImage();

    expect(html).not.toContain(admin.shape.cornerRadius);
  });

  it('animation variant: source tabs + placement disclosure + playback, still no drag canvas', () => {
    const html = renderAnimation();

    expect(html).toContain(admin.animation.placementGroup);
    expect(html).toContain('10:20 · 120×80');
    expect(html).toContain(admin.media.tab.library);
    expect(html).toContain(admin.media.tab.upload);
    expect(html).toContain(admin.media.tab.url);
    expect(html).toContain(admin.animation.playback);
    expect(html).not.toContain(admin.animation.dragHint);
  });
});

describe('placementSummary', () => {
  const t = ((key: string) => key) as unknown as TFunction<'admin'>;

  it('reads "Default" (the summaryChip key) when nothing is overridden', () => {
    expect(placementSummary(t, {})).toBe('summaryChip.default');
    // Solid opacity and zero rotation are the engine defaults — they must not clutter the chip.
    expect(placementSummary(t, { opacity: 1, rotation: 0 })).toBe('summaryChip.default');
  });

  it('lists every override, joined with a middot', () => {
    expect(
      placementSummary(t, { position: '10:20', scale: '120:80', opacity: 0.5, rotation: 15, flip: 'horizontal' })
    ).toBe('10:20 · 120×80 · 50% · 15° · ↔');
  });

  it('maps the mirror axes to glyphs', () => {
    expect(placementSummary(t, { flip: 'vertical' })).toBe('↕');
    expect(placementSummary(t, { flip: 'both' })).toBe('↔↕');
  });
});
