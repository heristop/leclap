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
import { PlacementControls, placementSummary, playbackSummary, timingSummary } from './placementControls';

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

const panel: ImageOverlay = {
  id: 'panel-1',
  choice: { source: 'url', url: 'panel:w=380,h=150,r=28,c=0a0f14,o=0.72' },
  position: '10:20',
  scale: '380:150',
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

  it('panel overlay: rounded-panel backdrop controls replace the media picker, placement stays', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <PlacementControls kind="image" orientation="landscape" value={panel} onChange={noop} />
      </I18nextProvider>
    );

    expect(html).toContain(admin.panel.radius);
    expect(html).toContain(admin.panel.color);
    expect(html).toContain(admin.panel.opacity);
    // Placement stays; the media source picker is gone (a panel backdrop has no source to pick).
    expect(html).toContain(admin.animation.placementGroup);
    expect(html).not.toContain(admin.media.tab.library);
  });

  it('plain image and shape overlays show no panel controls', () => {
    const imageHtml = renderImage();
    const shapeHtml = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <PlacementControls kind="image" orientation="landscape" value={shape} onChange={noop} />
      </I18nextProvider>
    );

    expect(imageHtml).not.toContain(admin.panel.radius);
    expect(shapeHtml).not.toContain(admin.panel.radius);
  });

  it('image variant: show window + entrance grouped under a collapsed timing disclosure with a summary', () => {
    const html = renderImage();

    // The disclosure header carries the group label and, while collapsed, the "Default" state chip;
    // the numeric fields themselves render only once expanded (static markup escapes the ampersand).
    expect(html).toContain(admin.imageOverlay.timingGroup.replace('&', '&amp;'));
    expect(html).toContain(admin.summaryChip.default);
    expect(html).not.toContain(admin.imageOverlay.startLabel);
  });

  it('shape image: the same timing & entrance disclosure applies', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <PlacementControls kind="image" orientation="landscape" value={shape} onChange={noop} />
      </I18nextProvider>
    );

    expect(html).toContain(admin.imageOverlay.timingGroup.replace('&', '&amp;'));
  });

  it('animation variant: source tabs + placement disclosure + collapsed playback disclosure, still no drag canvas', () => {
    const html = renderAnimation();

    expect(html).toContain(admin.animation.placementGroup);
    expect(html).toContain('10:20 · 120×80');
    expect(html).toContain(admin.media.tab.library);
    expect(html).toContain(admin.media.tab.upload);
    expect(html).toContain(admin.media.tab.url);
    expect(html).toContain(admin.animation.playback);
    // The collapsed playback summary mirrors the default extent ("Forever").
    expect(html).toContain(admin.animation.forever);
    expect(html).not.toContain(admin.animation.dragHint);
  });
});

describe('timingSummary', () => {
  const t = ((key: string) => key) as unknown as TFunction<'admin'>;

  it('reads "Default" (the summaryChip key) when the window is open and no entrance is set', () => {
    expect(timingSummary(t, {})).toBe('summaryChip.default');
    expect(timingSummary(t, { start: 0, end: 0 })).toBe('summaryChip.default');
  });

  it('formats the show window, leaving an open side blank', () => {
    expect(timingSummary(t, { start: 2, end: 5 })).toBe('2s → 5s');
    expect(timingSummary(t, { start: 2 })).toBe('2s →');
    expect(timingSummary(t, { end: 5 })).toBe('→ 5s');
  });

  it('appends the entrance style by its reveal key, for both value shapes', () => {
    expect(timingSummary(t, { start: 2, motion: 'rise' })).toBe('2s → · reveal.rise');
    expect(timingSummary(t, { motion: { type: 'fade' } })).toBe('reveal.fade');
    expect(timingSummary(t, { motion: 'none' })).toBe('summaryChip.default');
  });
});

describe('playbackSummary', () => {
  const t = ((key: string) => key) as unknown as TFunction<'admin'>;
  const base: AnimationOverlay = { id: 'a', url: '/a.apng' };

  it('reads the extent: forever by default, loops, or seconds', () => {
    expect(playbackSummary(t, base)).toBe('animation.forever');
    expect(playbackSummary(t, { ...base, loops: 2 })).toBe('animation.summaryLoops');
    expect(playbackSummary(t, { ...base, loop: false })).toBe('animation.summaryLoops');
    expect(playbackSummary(t, { ...base, duration: 3 })).toBe('3s');
  });

  it('appends a delayed start', () => {
    expect(playbackSummary(t, { ...base, start: 2 })).toBe('animation.forever · animation.summaryFrom');
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
