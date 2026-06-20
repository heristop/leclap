// @vitest-environment node
// Renders SectionCanvasMediaBox to static markup (the web app has no jsdom/@testing-library, so we
// assert on the server-rendered HTML for the a11y contract: role/aria-pressed/aria-label + grips).
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import type { AnimationOverlay } from '../templateEditorModel';
import { SectionCanvasMediaBox } from './sectionCanvasMediaBox';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const overlay: AnimationOverlay = { url: '/assets/animations/confetti.apng', position: '10:20', scale: '120:80' };

const noop = () => {};
const noFrame = (): DOMRect | undefined => undefined;

const render = (active: boolean) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SectionCanvasMediaBox
        value={overlay}
        url={overlay.url}
        kind="animation"
        orientation="landscape"
        active={active}
        frameRect={noFrame}
        onSelect={noop}
        onMove={noop}
        onResize={noop}
        onRotate={noop}
        onNudge={noop}
        onDelete={noop}
      />
    </I18nextProvider>
  );

describe('SectionCanvasMediaBox', () => {
  it('exposes the drag-hint button with grips when active', () => {
    const html = render(true);

    expect(html).toContain('role="button"');
    expect(html).toContain(`aria-label="${admin.animation.dragHint}"`);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(`aria-label="${admin.element.resize}"`);
    expect(html).toContain(`aria-label="${admin.element.rotate}"`);
  });

  it('hides grips and is unpressed when inactive', () => {
    const html = render(false);

    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain(`aria-label="${admin.element.resize}"`);
    expect(html).not.toContain(`aria-label="${admin.element.rotate}"`);
  });
});
