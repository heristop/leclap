# Search-facing build and routing

`pnpm --filter @leclap/web build` emits per-route metadata, full HTML for developer guides and the curated sample watch pages, and a canonical sitemap. The sitemap omits optional `lastmod` until reliable per-page content-change dates are available.

Production uses Cloudflare Pages. The build also emits:

- `_worker.js` from `src/hosting/pages-worker.ts`: permanent legacy/locale redirects, the exact production `leclap.pages.dev` hostname redirect, and noindex shells for utility/editor URLs. Branch preview hostnames stay accessible.
- `404.html`: disables Pages' implicit SPA fallback so unknown URLs return HTTP 404 while the client still renders the branded error view.
- `app-shell.html` per locale: preserves valid editor URLs, including `/templates/:id/edit`, with `noindex` present before JavaScript runs.

The handler forwards other requests unchanged to `env.ASSETS`, preserving Pages' asset behavior and the `_headers` rules required by FFmpeg WASM. This uses Pages Functions; include the emitted worker and route manifest in deployments. The separate `wrangler.jsonc` Workers configuration does not configure production Pages routing.

Test the actual Pages behavior, rather than Vite's preview server:

```sh
pnpm --filter @leclap/web preview:pages
E2E_PAGES=1 E2E_PRERENDER=1 E2E_BASE_URL=http://localhost:5413 pnpm --filter @leclap/web exec playwright test e2e/seo-hosting.spec.ts e2e/doc-prerender.spec.ts
```

Add curated watch pages to `src/config/sample-pages.ts` and explicit routes to `src/App.tsx`. The prerender and sitemap consume that manifest; tests verify that each page has a real catalog sample, article content, playable preview and downloadable JSON. Keep English-only pages canonical at the root instead of publishing untranslated locale copies.
