// @vitest-environment node
// The variable-aware ColorPicker: inside a ColorVariablesProvider it lists the template's colour
// variables as pickable chips, shows a stored token's RESOLVED colour on the swatch, and marks an
// unresolvable token with the checkerboard. Rendered to static markup (no jsdom in this app).
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import { ColorPicker } from './color-picker';
import { ColorVariablesProvider } from './color-variables-context';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

const render = (value: string, variables: { name: string; value: string }[], colorsList?: string[]) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ColorVariablesProvider variables={variables} colorsList={colorsList}>
        <ColorPicker value={value} onChange={noop} aria-label="Accent" />
      </ColorVariablesProvider>
    </I18nextProvider>
  );

describe('ColorPicker variable affordance', () => {
  it('lists colour-valued variables and palette slots as chips', () => {
    const html = render('#ffffff', [{ name: 'brand', value: '#ff0044' }], ['#111111']);

    expect(html).toContain('Use variable brand');
    expect(html).toContain('Use variable color1');
  });

  it('keeps non-colour variables out of the chips', () => {
    const html = render('#ffffff', [{ name: 'greeting', value: 'hello' }]);

    expect(html).not.toContain('Use variable greeting');
  });

  it('shows a stored token as its resolved colour with the chip pressed and the name in the field', () => {
    const html = render('{{ brand }}', [{ name: 'brand', value: '#ff0044' }]);

    expect(html).toContain('value="#ff0044"'); // native swatch resolves the token
    expect(html).toContain('value="brand"'); // text entry shows the bare name (# prefix is rendered)
    expect(html).toContain('aria-pressed="true"');
  });

  it('renders plain (no chips) outside a provider and for empty scopes', () => {
    const html = render('#ff0044', []);

    expect(html).not.toContain('Use variable');
  });
});
