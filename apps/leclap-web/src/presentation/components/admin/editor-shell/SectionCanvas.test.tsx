// @vitest-environment node
// SectionCanvas derives ALL selection from the shared `selection` prop (no internal state). The web
// app has no jsdom/@testing-library, so we render to static markup and assert the a11y contract. SSR
// does not run effects, so we exercise ANIMATION + LAYER selection (synchronous urls/positions),
// not image overlays (their url is resolved by an effect-driven hook).
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import type { AnimationOverlay, BackgroundLayer } from '../templateEditorModel';
import { SectionCanvas } from './SectionCanvas';
import type { SectionSelectionState } from './useSectionSelection';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

const baseLayer: BackgroundLayer = { color: '#101018', opacity: 1 };
const extraLayer: BackgroundLayer = { color: '#7C83FD', opacity: 1, x: 10, y: 10, w: 40, h: 40 };
const animation: AnimationOverlay = { url: '/assets/animations/confetti.apng', position: '10:20', scale: '120:80' };

const render = (selection: SectionSelectionState, extra: Partial<Parameters<typeof SectionCanvas>[0]> = {}) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SectionCanvas
        overlays={[]}
        orientation="landscape"
        selection={selection}
        onSelectElement={noop}
        onBeginEdit={noop}
        onEndEdit={noop}
        onChange={noop}
        {...extra}
      />
    </I18nextProvider>
  );

describe('SectionCanvas selection from props', () => {
  it('marks the active background layer box as pressed', () => {
    const html = render(
      { element: { kind: 'layer', index: 1 }, editing: false },
      { layers: { items: [baseLayer, extraLayer], onChange: noop } }
    );

    expect(html).toContain('aria-pressed="true"');
  });

  it('marks the active animation media box as pressed', () => {
    const html = render(
      { element: { kind: 'animation', index: 0 }, editing: false },
      { animations: [animation], onChangeAnimations: noop }
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(`aria-label="${admin.animation.dragHint}"`);
  });

  it('marks nothing as pressed when selection is empty', () => {
    const html = render(
      { element: null, editing: false },
      { layers: { items: [baseLayer, extraLayer], onChange: noop }, animations: [animation], onChangeAnimations: noop }
    );

    expect(html).not.toContain('aria-pressed="true"');
  });
});
