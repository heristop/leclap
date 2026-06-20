// @vitest-environment node
// Renders SaveStatusIndicator to static markup (the web app has no jsdom/@testing-library, so we
// assert on the server-rendered HTML for each save state).
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import builder from '@/i18n/locales/en/builder.json';
import { SaveStatusIndicator, type SaveStatus } from './SaveStatusIndicator';

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['builder'],
    defaultNS: 'builder',
    resources: { en: { builder } },
  });
});

const render = (status: SaveStatus, lastSavedAt: number | null) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SaveStatusIndicator status={status} lastSavedAt={lastSavedAt} />
    </I18nextProvider>
  );

describe('SaveStatusIndicator', () => {
  it('shows the saving label while saving', () => {
    expect(render('saving', null)).toContain(builder.editor.save.saving);
  });

  it('shows the saved label once saved', () => {
    expect(render('saved', Date.now())).toContain(builder.editor.save.saved);
  });

  it('shows the failed label on error', () => {
    expect(render('error', null)).toContain(builder.editor.save.failed);
  });

  it('renders nothing when idle', () => {
    expect(render('idle', null)).toBe('');
  });
});
