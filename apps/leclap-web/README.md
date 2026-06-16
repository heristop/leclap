# @leclap/web — LeClap web

React 19 + Vite + Tailwind web app for LeClap. It compiles videos **entirely in the browser** via WebAssembly FFmpeg — no server, no upload (2 GB input limit) — rendering the same [`@leclap/creative-kit`](../../packages/leclap-creative-kit) templates as the mobile app and CLI. Includes the guided builder, the visual template editor, and the first-run onboarding.

## Run

```bash
pnpm install              # from the repo root
pnpm playground:web       # dev server   (or: pnpm --filter @leclap/web dev)
```

No backend is required — the compile runs entirely in a Web Worker via `@ffmpeg/ffmpeg`.

## Notes

- **Build / preview** — `pnpm --filter @leclap/web build` then `... preview`.
- **Routing** — React Router; pages under `src/presentation/pages/` (Home, Builder, Templates, Doc, …).
- **Assets** — bundled media/fonts are staged from `@leclap/creative-kit` into `public/` on dev/build (git-ignored).

## Deploy — Cloudflare Pages (leclap.dev)

The app is a static SPA, so deployment is "build, then upload `dist/`". It compiles video with
FFmpeg WASM, which needs **cross-origin isolation** — `public/_headers` sets the required
`COOP`/`COEP`/`CORP` headers in production (mirroring `vite.config.ts`'s dev server), and
`public/_redirects` adds the SPA fallback. Both are copied into `dist/` by Vite and read by Pages.

```bash
# one-time: register leclap.dev in Cloudflare, then authenticate + create the project
pnpm dlx wrangler login
pnpm dlx wrangler pages project create leclap --production-branch main

# build and deploy (run from the repo root)
pnpm --filter @leclap/web build
pnpm dlx wrangler pages deploy apps/leclap-web/dist --project-name=leclap
```

Bind the custom domain in the Cloudflare dashboard → Pages → **leclap** → Custom domains
(`leclap.dev`). `.dev` is HSTS-preloaded (HTTPS-only); Cloudflare provisions TLS automatically.

**Verify after deploy:** open DevTools on the live URL, confirm the document response carries the
`Cross-Origin-Opener-Policy`/`Embedder-Policy` headers and `crossOriginIsolated === true`, then run
a compile end-to-end and hard-refresh a deep link (e.g. `/templates`) to confirm SPA routing.

### Social card

`public/og-image.png` (2400×1260 — the recommended 1.91:1 ratio at 2× for high-DPI feeds,
referenced by `index.html`/`Seo.tsx`) is rendered from the Remotion brand composition —
regenerate it with `pnpm --filter @leclap/brand-motion render:og`.

---

Part of the [LeClap monorepo](../../README.md). MIT licensed.
