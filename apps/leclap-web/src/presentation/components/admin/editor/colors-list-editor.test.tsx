// @vitest-environment node
// The Advanced-panel palette editor: one ColorPicker row per colorsList slot (labelled #colorN),
// a remove button per row, and an add button. Rendered to static markup (no jsdom in this app).
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import type { EditorState } from '../templateEditorModel';
import { ColorsListEditor } from './colors-list-editor';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

const render = (colorsList?: string[]) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ColorsListEditor state={{ colorsList } as EditorState} patch={noop} />
    </I18nextProvider>
  );

describe('ColorsListEditor', () => {
  it('renders one labelled swatch row per palette slot', () => {
    const html = render(['#111111', '#fafaf9']);

    expect(html).toContain('#color1');
    expect(html).toContain('#color2');
    expect(html).toContain('value="#111111"'); // native swatch carries the resolved colour
    expect(html).toContain('value="#fafaf9"');
    expect(html).toContain('Remove palette colour 1');
    expect(html).toContain('Remove palette colour 2');
  });

  it('keeps the palette slots literal: no variable chips inside the palette editor', () => {
    expect(render(['#111111'])).not.toContain('Use variable');
  });

  it('renders just the header and add button for an absent palette', () => {
    const html = render();

    expect(html).toContain('Add colour');
    expect(html).not.toContain('Remove palette colour');
    expect(html).not.toContain('type="color"');
  });
});
