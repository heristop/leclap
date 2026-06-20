// @vitest-environment node
// Renders ElementList to static markup (no jsdom in the web app), asserting the a11y contract for the
// cross-kind element list: one selectable row per descriptor with aria-pressed mirroring the active
// ref, per-row delete + move-up/move-down controls, and the empty state.
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import type { ElementDescriptor } from './sectionElements';
import { ElementList } from './ElementList';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const elements: ElementDescriptor[] = [
  { ref: { kind: 'layer', index: 0 }, kind: 'layer', labelKey: 'element.layer', labelParams: { n: 1 } },
  { ref: { kind: 'text', index: 0 }, kind: 'text', labelKey: 'element.text', labelParams: { n: 1 } },
  { ref: { kind: 'animation', index: 0 }, kind: 'animation', labelKey: 'element.animation', labelParams: { n: 1 } },
];

const noop = () => {};

const render = (els: ElementDescriptor[], active: ElementDescriptor['ref'] | null) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ElementList elements={els} activeRef={active} onSelect={noop} onDelete={noop} onMove={noop} />
    </I18nextProvider>
  );

describe('ElementList', () => {
  it('renders one row per descriptor with the active row pressed', () => {
    const html = render(elements, { kind: 'text', index: 0 });

    expect(html.match(/aria-pressed="/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
  });

  it('exposes a delete control on each row', () => {
    const html = render(elements, null);

    expect(html.match(new RegExp(`aria-label="${admin.element.delete}"`, 'g'))).toHaveLength(3);
  });

  it('disables move-up on the first row and move-down on the last row', () => {
    const html = render(elements, null);
    // React SSR renders the whole opening tag; a disabled button carries a boolean `disabled=""`.
    const upMatches = [...html.matchAll(new RegExp(`<button[^>]*aria-label="${admin.element.moveUp}"[^>]*>`, 'g'))];
    const downMatches = [...html.matchAll(new RegExp(`<button[^>]*aria-label="${admin.element.moveDown}"[^>]*>`, 'g'))];

    expect(upMatches).toHaveLength(3);
    expect(downMatches).toHaveLength(3);
    expect(upMatches[0][0]).toContain('disabled=""');
    expect(upMatches[1][0]).not.toContain('disabled=""');
    expect(downMatches[2][0]).toContain('disabled=""');
    expect(downMatches[1][0]).not.toContain('disabled=""');
  });

  it('renders the empty state for an empty list', () => {
    const html = render([], null);

    expect(html).toContain(admin.element.empty);
  });
});
