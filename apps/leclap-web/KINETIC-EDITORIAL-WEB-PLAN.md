# Kinetic Editorial — Web Adoption Plan

Port the "Kinetic Editorial with pro-editor bones" direction from `apps/leclap-expo` to
`apps/leclap-web`, mirroring the _structure_ of the mobile system (tokens + five signature
primitives + one showpiece), not the React Native code. Light-first, oversized left-aligned
Oswald display type, pro-editor vocabulary (filmstrip spine, playhead/arc meters, program-monitor
framing), TikTok/IG tempo, brand lavender→pink reserved for fills/edges/meters.

## 1. Token mapping (Expo → web `src/index.css`, additive)

| Expo source                               | Web token / utility (new)                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `theme.ts` `typography.display*`          | `--text-display-hero/-xl/-l/-m/-s` clamp scale in `@theme`                                                       |
| `motion.ts` `duration`                    | `--dur-fast/-base/-slow/-ring` in `@theme` (+ `kinetic/motion.ts` for JS, seconds)                               |
| `motion.ts` `stagger`, `spring.tap`       | `kinetic/motion.ts` (`stagger`, `spring.tap`) for motion/react                                                   |
| `elevation.ts` `card`/`raised`/`hairline` | `@utility elevation-card`, `elevation-raised`, `hairline` (brand-tinted, never `#000`) + `--shadow-card/-raised` |
| `gradients.ts` `brand`/`monitor`          | reuse existing `brand-gradient` utility + `--color-brand-500`/`--color-secondary-400` (SVG stops)                |

Existing tokens (`--text-display`, `--ease-*`, `brand-gradient`, `studio-stage`, `playhead-link`,
`track-lane`, `take-counter`) stay untouched — the new scale layers alongside them.

## 2. Signature primitives → `src/presentation/components/kinetic/` (React + motion/react)

Mirrors `apps/leclap-expo/src/components/kinetic/*`, each non-trivial one with a pure `*.logic.ts`
split out and vitest-tested (TDD, failing test first).

- **KineticHeading** (`kinetic-heading.tsx` + `split-text.logic.ts`) — oversized Oswald, revealed
  word-by-word with a staggered rise. Honours `useReducedMotion` (renders settled). Levels
  `hero/xl/l/m/s` → the new display scale.
- **GradientMeter** (`gradient-meter.tsx` + `gradient-meter.logic.ts`) — `bar` / `playhead` / `arc`
  (SVG) lavender→pink progress, one family for card meters, scrubbers and rings.
- **FilmstripEdge** (`filmstrip-edge.tsx` + `filmstrip-edge.logic.ts`) — vertical film spine: a
  hairline rail dotted with evenly-spaced sprocket perforations (height measured via ResizeObserver,
  offsets from the pure logic).
- **ProgramMonitor** (`program-monitor.tsx`) — preview framing: hairline frame, corner registration
  brackets, a `PROGRAM` tally chip, optional playhead scrubber; light default + `dark` stage.
- **PressableScale** (`pressable-scale.tsx`) — tactile tap wrapper (motion/react `whileTap` scale +
  `web-haptics`), reduced-motion aware.

`index.ts` barrels all five.

## 3. Showpiece — `StudioHome` (the studio gallery, `TemplateSelector` is StudioHome-only)

- **Masthead**: `StudioSurface` gains an optional additive `titleSlot` prop (other 4 consumers —
  Projects/Partials/Admin/Policy — pass nothing and keep the plain `<h1>`). StudioHome passes a
  `KineticHeading` (staggered oversized reveal).
- **Template cards** (`TemplateSelector`): a `FilmstripEdge` spine on the left edge, the poster
  band wrapped in `ProgramMonitor` framing (brackets + `PROGRAM` tally), and a `GradientMeter` bar
  reading the template's complexity. `TemplatePoster` (shared with Admin) is left unchanged — the
  framing wraps it.
- **CTA**: "Build from scratch" wrapped in `PressableScale` for a tactile, haptic press.

All routing, i18n and behavior preserved.

## 4. Verify

`pnpm --filter @leclap/web typecheck`, `vp lint apps/leclap-web`, `pnpm --filter @leclap/web test`.
