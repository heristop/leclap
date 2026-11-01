import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { LOCALE_CODES, LOCALIZED_ROUTES, type Language } from '../src/config/site';
import { Home } from '../src/presentation/pages/Home';
import { Showcase } from '../src/presentation/pages/Showcase';
import { StudioHome } from '../src/presentation/pages/StudioHome';
import { About } from '../src/presentation/pages/About';
import { CompareRemotion } from '../src/presentation/pages/compare-remotion';
import { Legal } from '../src/presentation/pages/Legal';
import { Privacy } from '../src/presentation/pages/Privacy';
import { Header } from '../src/presentation/components/Header';
import { Footer } from '../src/presentation/components/Footer';

const pages: Partial<Record<string, ComponentType>> = {
  '/': Home,
  '/showcase': Showcase,
  '/studio': StudioHome,
  '/about': About,
  '/compare/remotion': CompareRemotion,
  '/legal': Legal,
  '/privacy': Privacy,
};

// Render the actual page components with an isolated locale per render. The browser still
// mounts normally, including scroll reveals; no browser storage or effects run at build time.
export async function renderMarketing(): Promise<Record<Language, Record<string, string>>> {
  const entries = await Promise.all(
    LOCALE_CODES.map(async (language) => {
      const bundle = await import(`../src/i18n/locales/${language}/index.ts`);
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        resources: { [language]: bundle[language] },
        defaultNS: 'common',
        interpolation: { escapeValue: false },
      });
      const bodies: Record<string, string> = {};

      for (const { path } of LOCALIZED_ROUTES) {
        const Page = pages[path];

        if (!Page) throw new Error(`Missing marketing page renderer: ${path}`);
        const basename = language === 'en' ? '/' : `/${language}`;
        const url = language === 'en' ? path : `/${language}${path === '/' ? '' : path}`;
        const router = createMemoryRouter(
          [
            {
              path,
              element: (
                <>
                  <Header />
                  <main id="main-content">
                    <Page />
                  </main>
                  <Footer />
                </>
              ),
            },
          ],
          { basename, initialEntries: [url] }
        );
        bodies[path] = renderToStaticMarkup(
          <I18nextProvider i18n={i18n}>
            <RouterProvider router={router} />
          </I18nextProvider>
        );
        router.dispose();
      }

      return [language, bodies] as const;
    })
  );

  return Object.fromEntries(entries) as Record<Language, Record<string, string>>;
}
