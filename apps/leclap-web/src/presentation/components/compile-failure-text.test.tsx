// @vitest-environment node
// Renders CompileFailureText to static markup (the web app has no jsdom/@testing-library): a kind without its
// line in the English bundle would show the viewer the raw `compileError.<kind>` key.
import { beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import common from '@/i18n/locales/en/common.json';
import type { CompileFailure } from '@/application/usecases/compile-failure';
import { CompileFailureText } from './compile-failure-text';

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    resources: { en: { common } },
  });
});

const render = (failure: CompileFailure) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <CompileFailureText failure={failure} />
    </I18nextProvider>
  );

describe('CompileFailureText', () => {
  it('tells the viewer the engine could not be downloaded, and leaves the raw error out', () => {
    expect(render({ kind: 'engineUnavailable', detail: '' })).toBe(common.compileError.engineUnavailable);
  });
});
