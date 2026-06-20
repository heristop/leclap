// @vitest-environment node
// Renders MediaPicker in its single-select-by-id mode to static markup (the web app has no jsdom/RTL):
// the library grid is a radiogroup with no Library/Upload/Url tabs, and the active item carries the
// selected ring + aria-pressed state used by the picture card.
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import { MediaPicker } from './MediaPicker';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

const render = (selectedId: string | null) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <MediaPicker
        kind="picture"
        selectedId={selectedId}
        onSelectId={noop}
        allowedIds={['forest-sea', 'desk-flatlay']}
      />
    </I18nextProvider>
  );

describe('MediaPicker single-select-by-id mode', () => {
  it('renders a radiogroup grid without the source tabs', () => {
    const html = render(null);

    expect(html).toContain('role="radiogroup"');
    expect(html).not.toContain(admin.media.source);
  });

  it('marks only the active item as selected', () => {
    const html = render('forest-sea');
    const pressed = html.match(/aria-pressed="true"/g) ?? [];

    expect(pressed).toHaveLength(1);
    expect(html).toContain('ring-brand-500/30');
  });
});
