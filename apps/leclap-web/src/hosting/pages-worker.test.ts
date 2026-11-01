import { describe, expect, it, vi } from 'vitest';
import worker, { localePrefixes, utilityPaths } from './pages-worker';
import { LOCALE_PREFIXES } from '../config/site';

const assets = () => ({
  ASSETS: {
    fetch: vi.fn(async () => new Response('asset', { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp' } })),
  },
});

describe('Pages SEO routing', () => {
  it('uses the site locales', () => expect(localePrefixes).toEqual(LOCALE_PREFIXES));
  it.each([
    ['/docs/cli?source=old', '/doc/cli?source=old'],
    ['/fr/docs/mcp', '/doc/mcp'],
    ['/de/doc/agents', '/doc/agents'],
    ['/fr/showcase/type-impact', '/showcase/type-impact'],
    ['/admin', '/templates'],
    ['/fr/builder?template=interview', '/fr/studio/new?template=interview'],
    ['/projects?source=bookmark', '/studio?source=bookmark#projects'],
    ['/use-cases/agentic-development', '/#agentic'],
  ])('permanently redirects %s', async (from, to) => {
    const env = assets();
    const response = await worker.fetch(new Request(`https://leclap.dev${from}`), env);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`https://leclap.dev${to}`);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });
  it('consolidates the production alias while preserving path and query', async () => {
    const response = await worker.fetch(new Request('https://leclap.pages.dev/docs/cli?x=1'), assets());
    expect(response.headers.get('Location')).toBe('https://leclap.dev/doc/cli?x=1');
  });
  it('keeps branch previews on their own host', async () => {
    const env = assets();
    const response = await worker.fetch(new Request('https://test.leclap.pages.dev/doc/cli'), env);
    expect(response.status).toBe(200);
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  });
  it.each([...utilityPaths, '/templates/abc/edit', '/fr/templates/abc/edit', '/de/studio/new/'])(
    'serves a noindex shell for %s',
    async (path) => {
      const env = assets();
      const response = await worker.fetch(new Request(`https://leclap.dev${path}`), env);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
      expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
      expect(env.ASSETS.fetch.mock.calls[0]?.length).toBe(1);
    }
  );
  it('preserves real asset statuses, including unknown pages and missing media', async () => {
    const env = { ASSETS: { fetch: vi.fn(async () => new Response('Not found', { status: 404 })) } };
    for (const path of ['/missing', '/showcase/unknown', '/templates/a/edit/extra', '/videos/missing.mp4']) {
      const response = await worker.fetch(new Request(`https://leclap.dev${path}`), env);
      expect(response.status).toBe(404);
    }
  });
  it('forwards range requests unchanged for video playback', async () => {
    const env = {
      ASSETS: { fetch: vi.fn(async (request: Request) => new Response(request.headers.get('Range'), { status: 206 })) },
    };
    const response = await worker.fetch(
      new Request('https://leclap.dev/videos/showcase/type-impact.mp4', { headers: { Range: 'bytes=0-999' } }),
      env
    );
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('bytes=0-999');
  });
});
