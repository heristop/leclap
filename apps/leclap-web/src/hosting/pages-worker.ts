// Standalone Pages advanced-mode handler. The build strips types into dist/_worker.js.
// Keep locale prefixes in sync with config/site.ts (covered by the hosting tests).
export const localePrefixes = ['fr', 'de', 'es', 'it'];
export const utilityPaths = ['/studio/new', '/studio/builder', '/templates', '/templates/new', '/partials'];

type Assets = { fetch(request: Request): Promise<Response> };

function splitLocale(pathname: string): { prefix: string; path: string } {
  const segment = pathname.split('/')[1];
  const prefix = localePrefixes.includes(segment) ? `/${segment}` : '';

  return { prefix, path: pathname.slice(prefix.length) || '/' };
}

function redirectPath(path: string, prefix: string): string | undefined {
  if (path === '/docs' || path.startsWith('/docs/')) return path.replace(/^\/docs/, '/doc');

  if (prefix && (path === '/doc' || path.startsWith('/doc/') || path === '/design' || path.startsWith('/showcase/'))) {
    return path;
  }

  const aliases: Record<string, string> = {
    '/admin': '/templates',
    '/builder': '/studio/new',
    '/projects': '/studio#projects',
    '/use-cases/agentic-development': '/#agentic',
  };

  return aliases[path] ? `${prefix}${aliases[path]}` : undefined;
}

export default {
  async fetch(request: Request, env: { ASSETS: Assets }): Promise<Response> {
    const url = new URL(request.url);
    const { prefix, path } = splitLocale(url.pathname.replace(/\/$/, '') || '/');
    const target = redirectPath(path, prefix);
    // Only the production alias redirects. Branch previews remain usable for review.
    if (url.hostname === 'leclap.pages.dev' || target) {
      const destination = new URL(target ?? `${url.pathname}${url.search}`, url);

      if (target) destination.search = url.search;

      if (url.hostname === 'leclap.pages.dev') {
        destination.protocol = 'https:';
        destination.host = 'leclap.dev';
      }

      return Response.redirect(destination.toString(), 301);
    }

    const utility = utilityPaths.includes(path) || /^\/templates\/[^/]+\/edit$/.test(path);

    if (utility) {
      // A fixed noindex shell keeps dynamic editor URLs working after enabling real 404s.
      const shell = new URL(`${prefix}/app-shell`, url);
      const response = await env.ASSETS.fetch(new Request(shell, request));
      const headers = new Headers(response.headers);
      headers.set('X-Robots-Tag', 'noindex, follow');
      headers.set('Cache-Control', 'no-cache');

      return new Response(response.body, { status: response.status, headers });
    }

    // 404.html disables Pages' implicit SPA fallback. Unknown paths now retain HTTP 404.
    return env.ASSETS.fetch(request);
  },
};
