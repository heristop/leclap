# @leclap/web — LeClap web

React 19 + Vite + Tailwind web app for LeClap. It compiles videos **entirely in the browser** via WebAssembly FFmpeg — no server, no upload (2 GB input limit) — rendering the same [`@leclap/creative-kit`](../../packages/creative-kit) templates as the mobile app and CLI. Includes the guided builder, the visual template editor, and the first-run onboarding.

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

---

Part of the [LeClap monorepo](../../README.md). MIT licensed.
