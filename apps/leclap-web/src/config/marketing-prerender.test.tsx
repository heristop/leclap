import { beforeAll, describe, expect, it } from 'vitest';
import { renderMarketing } from '../../scripts/render-marketing';
import { LOCALE_CODES, LOCALIZED_ROUTES, type Language } from './site';

let pages: Record<Language, Record<string, string>>;
beforeAll(async () => {
  pages = await renderMarketing();
}, 60_000);

describe('marketing static HTML', () => {
  it('renders every localized route with actual content and navigation', () => {
    for (const language of LOCALE_CODES) {
      expect(Object.keys(pages[language]).sort()).toEqual(LOCALIZED_ROUTES.map(({ path }) => path).sort());
      for (const { path } of LOCALIZED_ROUTES) {
        const html = pages[language][path];
        expect(html.match(/<h1\b/g), `${language} ${path}`).toHaveLength(1);
        expect(html).toContain('<main id="main-content">');
        expect(html).toContain('<footer');
        expect(html).not.toContain('Unexpected Application Error');
      }
    }
  });

  it('keeps locale content and links isolated between renders', () => {
    expect(pages.fr['/']).toContain('href="/fr/showcase"');
    expect(pages.de['/']).toContain('href="/de/showcase"');
    expect(pages.en['/']).toContain('href="/showcase"');
    expect(pages.fr['/privacy']).toContain('Confidentialité');
    expect(pages.en['/privacy']).toContain('Privacy');
    expect(pages.en['/compare/remotion']).toContain('Remotion');
    expect(pages.en['/showcase']).toContain('/showcase/type-impact');
  });

  it('publishes readable sections without needing an intersection observer', () => {
    expect(pages.en['/about']).not.toContain('opacity-0 translate-y-6');
    expect(pages.en['/about'].match(/<h1\b[\s\S]*?<\/h1>/)?.[0]).not.toContain('opacity:0');
    expect(pages.en['/']).toContain('AI');
    expect(pages.en['/']).toContain('browser-demo');
  });
});
