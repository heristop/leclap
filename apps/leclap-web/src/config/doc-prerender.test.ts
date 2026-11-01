import { beforeAll, describe, expect, it } from 'vitest';
import { renderDocs } from '../../scripts/render-docs';
import { DOC_ROUTES } from './doc-routes';

let pages: Record<string, string>;
beforeAll(async () => {
  pages = await renderDocs();
});

describe('developer guide static HTML', () => {
  it('renders every sitemap guide with article content and crawlable navigation', () => {
    const routes = DOC_ROUTES.filter(({ path }) => path === '/doc' || path.startsWith('/doc/'));
    expect(Object.keys(pages).sort()).toEqual(routes.map(({ path }) => path).sort());
    for (const { path } of routes) {
      const html = pages[path];
      expect(html.match(/<h1\b/g), path).toHaveLength(1);
      expect(html, path).toContain('<h2');
      expect(html, path).toContain('href="/doc/agents"');
      expect(html, path).toContain('href="/doc/mcp"');
      expect(html, path).toContain('href="/doc/cli"');
      expect(html.match(/<h1\b[\s\S]*?<\/h1>/)?.[0], path).not.toContain('opacity:0');
    }
  });

  it('includes the actual workflow and reference content, not only SEO summaries', () => {
    expect(pages['/doc/agents']).toContain('get_capabilities');
    expect(pages['/doc/agents']).toContain('mcpServers');
    expect(pages['/doc/cli']).toContain('--output');
    expect(pages['/doc/mcp']).toContain('compose_video');
    expect(pages['/doc']).toContain('AI motion graphics guide');
    expect(pages['/doc/mcp']).toContain('AI motion graphics walkthrough');
    expect(pages['/doc/cli']).toContain('JSON video examples');
  });
});
