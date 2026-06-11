# Upgrading from v1 to v2

The npm package name is **unchanged** — you still install `ffmpeg-video-composer`.
The `le-clap` → `leclap` rename in this release was internal to the monorepo
(directories and `@leclap/*` workspace scopes) and is **invisible to consumers**
of the published package. The core `compile` / `loadConfig` API is the same.

This guide covers only what a consumer of the npm package will actually notice.

## Node version

`engines.node` now requires **Node `>=24.11.0`** (v1 required `>=22.14.0`).
Upgrade your runtime; the package will refuse to install on older Node.

## Package layout / entry points

| Concern       | v1               | v2                                                 |
| ------------- | ---------------- | -------------------------------------------------- |
| CLI binary    | (none published) | `ffmpeg-video-composer` → `./dist/cli.js`          |
| Browser entry | (none)           | `ffmpeg-video-composer/browser`                    |
| RN entry      | (none)           | `ffmpeg-video-composer/reactnative`                |
| `compile.js`  | shipped script   | removed — use the CLI                              |
| `diagnose.js` | shipped script   | removed — use `ffmpeg-video-composer --diagnose`   |
| `./src/index` | available        | dropped (`.`, `./browser`, `./reactnative` remain) |

The default `.` import is unchanged:

```js
import { compile, loadConfig } from 'ffmpeg-video-composer';
```

New: validate templates with the library's own schema (additive, no migration needed):

```js
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';

const template = TemplateDescriptorSchema.parse(json);
```

## Security / behavior changes

These tighten how untrusted or edge-case templates are handled. If you feed
hand-crafted or user-supplied templates, review these:

- **No shell.** FFmpeg is now invoked via `execFile` instead of a shell, so
  shell metacharacters in template values are no longer interpreted.
- **argv tokens reject whitespace.** Template string values interpolated as
  unquoted ffmpeg argv tokens (e.g. a section `color`, an input `url`, a section
  name) now reject embedded whitespace and NUL bytes. A template whose `color`
  is `"red 0.5"` (raw space) now **throws** instead of silently injecting extra
  ffmpeg arguments. Use a valid single-token value (`red@0.5`); real URLs should
  percent-encode spaces.
- **SSRF guard on remote fetches (server-side).** When the Node runtime fetches
  a remote `videoUrl` / `music.url` / background URL, it now refuses:
  - non-`http(s)` schemes (e.g. `file:`, `gopher:`),
  - private / reserved / loopback / link-local addresses, including the cloud
    metadata address `169.254.169.254` and `localhost`,
  - hostnames that resolve to any of the above — re-checked across HTTP redirects.

  Templates that legitimately reference public `http(s)` media are unaffected.

## Still the same

- The `compile(projectConfig, template)` / `loadConfig(path)` API and template
  JSON format are unchanged.
- FFmpeg detection order (system → `ffmpeg-static` → WASM) is unchanged.
- `drawtext`-capable FFmpeg is still required for text / background-color
  segments.
