import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { SAMPLE_PAGES } from '../src/config/sample-pages';
import { ShowcaseSample } from '../src/presentation/pages/ShowcaseSample';
import { en } from '../src/i18n/locales/en';
import * as docs from '../src/presentation/pages/doc';
import * as references from '../src/presentation/pages/doc/References';

const pages = {
  '/doc': docs.DocOverview,
  '/doc/agents': references.DocAgents,
  '/doc/sections': docs.DocSections,
  '/doc/transitions': docs.DocTransitions,
  '/doc/looks': docs.DocLooks,
  '/doc/grade': docs.DocGrade,
  '/doc/motion': docs.DocMotion,
  '/doc/audio': docs.DocAudio,
  '/doc/captions': docs.DocCaptions,
  '/doc/animations': docs.DocAnimations,
  '/doc/filters': docs.DocFilters,
  '/doc/examples': docs.DocExamples,
  '/doc/schema': docs.DocSchema,
  '/doc/cli': docs.DocCli,
  '/doc/mcp': docs.DocMcp,
  '/doc/webmcp': docs.DocWebMcp,
  '/doc/reference': references.DocReference,
  '/doc/effects': references.DocEffects,
  '/doc/engine': references.DocEngine,
  '/doc/creative-direction': references.DocCreativeDirection,
};

// Use the same article and navigation components as the browser, without loading the editor,
// browser router or device services. Static content is replaced when the client app mounts.
export async function renderDocs(): Promise<Record<string, string>> {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en }, defaultNS: 'common', interpolation: { escapeValue: false } });

  return Object.fromEntries(
    Object.entries(pages).map(([url, Page]) => [
      url,
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[url]}>
            <main>
              <a href="/" className="absolute left-4 top-4 font-display text-xl text-primary">
                LeClap home
              </a>
              <Routes>
                <Route element={<docs.DocLayout />}>
                  <Route path={url} element={<Page />} />
                </Route>
              </Routes>
            </main>
          </MemoryRouter>
        </I18nextProvider>
      ),
    ])
  );
}

export async function renderSamplePages(): Promise<Record<string, string>> {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en }, defaultNS: 'common', interpolation: { escapeValue: false } });

  return Object.fromEntries(
    SAMPLE_PAGES.map((page) => [
      page.path,
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[page.path]}>
            <main>
              <ShowcaseSample sampleId={page.id} />
            </main>
          </MemoryRouter>
        </I18nextProvider>
      ),
    ])
  );
}
