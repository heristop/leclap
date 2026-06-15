# @leclap/server-app

> ⚠️ **Demo server.** This is a reference implementation showing how to expose the
> `ffmpeg-video-composer` library over HTTP. It has **no authentication, no rate
> limiting, and no upload quotas**, and it accepts requests from **any origin**
> (`CORS origin: true`). Do **not** expose it to untrusted traffic without
> hardening it first (auth, quotas, input validation, a reverse proxy, etc.).

A small [Fastify](https://fastify.dev/) server that wraps `ffmpeg-video-composer`
to compile templates into videos over HTTP. It powers local development and the
Expo app's server-backed compile fallback.

## Run

From the repo root:

```bash
pnpm server:dev
```

This builds the core library, builds the server, and starts it. The server listens
on **port `8082`** bound to `0.0.0.0` (so emulators and devices on the LAN can reach
it). Within the package you can also run `pnpm --filter @leclap/server-app build`
then `... start`.

## Endpoints

| Method | Path         | Description                                                                   |
| ------ | ------------ | ----------------------------------------------------------------------------- |
| `GET`  | `/health`    | Liveness check — returns status, uptime, memory, and version.                 |
| `GET`  | `/templates` | Lists the bundled template JSON files from `templates/`.                      |
| `POST` | `/compile`   | Compiles a template (multipart upload of assets) and returns the output path. |
| `GET`  | `/serve/*`   | Serves compiled outputs from the package `build/` directory as static files.  |

## Configuration

- **Port / host** — currently fixed at `8082` / `0.0.0.0` in `src/index.ts`.
- **Upload limits** — multipart is capped at 100 MB per file, 10 files per request.
- **Templates** — JSON files in `packages/server-app/templates/` are exposed via
  `/templates`.

Clients point at the server with `VITE_API_URL` (web) or `extra.API_URL` (Expo),
both defaulting to `http://localhost:8082`.

---

Part of the [LeClap monorepo](../../README.md).
