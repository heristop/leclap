# Search-facing build and routing

`pnpm --filter @leclap/web build` emits per-route metadata, full HTML for all 35 localized marketing routes, developer guides and curated sample watch pages, and a canonical sitemap. The sitemap omits optional `lastmod` until reliable per-page content-change dates are available.

`scripts/render-marketing.tsx` renders the existing React pages, header and footer with an isolated i18next instance per language. Localized links use the same router basename as the browser. The studio initially renders its public shell; saved projects, compatibility checks and template loading remain client-side. No browser storage is read during prerendering. Builds fail if a declared marketing route has no heading. `/design` remains client-rendered.

Static reveal wrappers and kinetic headings are visible without JavaScript. The client replaces the static root using its existing mount flow, retaining normal scroll-reveal animations and reduced-motion behavior; this is not React hydration. Keep both the no-JavaScript reading experience and the interactive client covered when changing motion components.

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

Curated watch pages also emit video sitemap entries (thumbnail, title, description and direct MP4 URL). Publication dates are omitted until verified. `src/config/social-image.ts` supplies matching sample thumbnails and dimensions to prerendering and client navigation, resetting the default preview when leaving a sample page. English-only guides retain `en_US` Open Graph metadata even when the surrounding navigation uses another language.
