# LeClap showcase — storyboard

A 78-second trailer (1920×1080, 30 fps) that presents LeClap, shows it on desktop and on the phone,
lists what people make with it, and closes on agentic development. Composition id: `LeClapShowcase`.

```bash
pnpm --filter @leclap/brand-motion render:showcase        # voice + score + picture → out/leclap-showcase.mp4
pnpm --filter @leclap/brand-motion studio                 # scrub it in Remotion Studio
```

## Rules the film is cut to

1. **Something happens on screen in every shot.** No static slide; the camera always moves.
2. **Every cut is motivated by an action.** A clap throws the curtain open; the camera flies into the
   wordmark; a whip pan; a dive into a card; a monitor switches off into a line of light that becomes a
   phone; a dive through the phone's glass into the same footage, full screen.
3. **One cast member, fixed design.** Clappy — the logo's clapperboard, hand-drawn and chubby, with a
   face, chubby arms and little feet. Only pose and expression change. When Clappy slams shut, the
   edit cuts.
4. **One clock.** Picture, score and voice read their cues from `timeline.ts`; every scene boundary sits
   on a bar line of the 120 BPM score.
5. **Claims stay true** (PRODUCT.md). Real screen captures only; LeClap renders the artifact, the
   agent's workflow attaches it; no invented metrics.

## Palette journey

Brand plum velvet → ink stage → lavender glow → (desktop) ink + lavender → (drop) lavender and pink
blazing → ink → the finale's lavender→pink gradient. Accent yellow only for cursors, code results,
the curtain fringe.

## Shot list

| Time  | Scene        | What happens                                                                                                                                                                                                                                                                                                                                                                           | Exit (motivation)                    |
| ----- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0–6   | `curtain`    | Dark theatre, a spotlight eases on. "Every video starts as an idea." Clappy pops up, looks around, waves, crouches — and SLAMS (5.2s).                                                                                                                                                                                                                                                 | Curtains fly open on the clap        |
| 6–10  | `title`      | Boom. Letters slam out of depth one by one, gradient pours over the word; Clappy free-falls in, squashes, ta-da.                                                                                                                                                                                                                                                                       | Camera flies into the wordmark       |
| 10–18 | `template`   | A JSON template types itself; FFmpeg core spins; the finished video lights a program monitor. Clappy points, gasps, claps (17.6s).                                                                                                                                                                                                                                                     | Whip pan on the clap                 |
| 18–24 | `everywhere` | Template hub; Node/CLI, Browser/WASM, iOS·Android cards fly in from deep space on the beats and wire up.                                                                                                                                                                                                                                                                               | Dive into the browser card           |
| 24–32 | `desktop`    | Real `/studio` + builder recordings in a swinging browser window; film-strip rail ticks through four steps (pick, drop, trim, build).                                                                                                                                                                                                                                                  | CRT switch-off to a hot line         |
| 32–48 | `mobile`     | The line becomes a phone. Pick a template (Clappy dives into the screen as the template); shoot — the app's recording screen over a woman filming herself (countdown 2 → 1 → REC); render — bezel progress trace, 1.75× speed ramp. **Drop at 40s**: the real Present Yourself render of her take plays; punch, rays, "ON-DEVICE" poster; No server / No upload / Stays on the device. | Dive through the glass (warp)        |
| 48–54 | `useCases`   | Match cut to the same footage as a full-bleed story. Social stories · Brand intros · Product demos (a real App Tutorial render of an edited builder capture) · Personalised videos, one per 3 beats.                                                                                                                                                                                   | Whip pan                             |
| 54–70 | `agentic`    | A fake Kiln & Co. shop PR ("make Add to cart obvious"): the agent log types (implement → record → validate → render → attach), the PR fills in, the engine-rendered before/after evidence drops in and flies out full-frame — BEFORE, a wipe, AFTER, narrated; the squint-o-meter falls out of the red on the wipe. "Don't describe the change. Show it." at 67s.                      | Clappy slams (69.6s), zoom to Clappy |
| 70–78 | `finale`     | Boom. Clappy drops onto the lockup, wordmark slams again, platforms, leclap.dev. Clappy bows, winks. Letterbox closes like an iris.                                                                                                                                                                                                                                                    | Fade to black                        |

## Sound

- **Score** (`audio/generate-score.ts`): synthesised in Node from oscillators and noise — A minor,
  Am–F–C–G, 120 BPM — in the "keynote minimal" palette (`audio/scores/keynote.ts`, the user's pick over a
  French-touch demo): a marimba ostinato, sub bass, snaps and a shaker over a clean kick, airy pads, bells.
  Music-box motif (curtain, breakdown, finale), half-time then four-on-the-floor pulse, 4-second riser
  and kick build into the drop, the melody on marimba and bells on the drop, a chord hit on each use-case
  card. Hits on 6 / 32 / 40 / 67 / 70 s, claps on Clappy's slams, whooshes under the cuts.
- **Voice** (`audio/generate-voice.ts`): 15 lines from `voice-lines.ts`, read by
  [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) — a local neural TTS (Apache-2.0 weights) —
  in the voice `af_heart` (swap with `LECLAP_VOICE=am_michael`, `bf_emma`, …), shaped with sox. The score
  ducks under every line (`showcase.tsx`). Both cuts are narrated in English (`src/film/narration.ts`): the
  French cut keeps the English voice under French text and French captions. Without Kokoro it falls back to macOS `say` (`LECLAP_TTS=say`).
  One-time setup (~470 MB, outside the repo):

  ```bash
  mkdir -p ~/.cache/leclap-tts && cd ~/.cache/leclap-tts
  uv venv venv --python 3.13 && uv pip install --python venv/bin/python kokoro-onnx soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  ```

## The other engine renders

Like the phone take, the film's other "results" are genuine LeClap output (`media/engine-render.ts` wraps
the CLI: validate, then render, assets staged offline):

- **Product demo** — `media/render-product-demo.ts`: the builder capture (`pick-background.mp4`) re-framed as a
  square walkthrough by the `LeClapProductDemoTake` composition (eased zooms that follow the clicks, a drawn
  cursor, click targets framed on the template's tap pulse), then composed with the creative-kit **App
  Tutorial** template → `app-tutorial-render.mp4`.
- **PR evidence** — `examples/agentic-pr-video/demo-shop/record.mjs` records before/after Playwright
  walkthroughs of the fake shop (`examples/agentic-pr-video/demo-shop/index.html`) into
  `public/captures/kiln-shop/`, and `media/render-pr-evidence.ts` composes them with
  `examples/agentic-pr-video/before-after.json` → `pr-evidence.mp4`.

## The phone take

The phone's result is genuine engine output: `media/render-phone-take.ts` renders the creative-kit
**Present Yourself (Portrait)** template with the LeClap CLI on 6 seconds of footage of someone filming
themselves (`pnpm --filter @leclap/brand-motion showcase:phone-take`, needs `@leclap/cli` built). The
recording screen before it is the app's camera UI (as in the Android demo capture) rebuilt over the same
footage (`recording-screen.tsx`), so the preview flows straight into the recorded take.

Footage: `public/captures/selfie-wave-source.mp4` — Pexels video
[6965115](https://www.pexels.com/video/a-woman-waving-her-hand-while-talking-6965115/), "A woman waving
her hand while talking" (Pexels License: free to use, no attribution required; don't present her as
endorsing the product).

## Animation notes

- Clappy follows the principles: anticipation (crouch / wind-up), squash on contact, stretch in flight,
  arcs (the dive into the phone is a parabola with a spin), follow-through (the stick wobbles open after
  a slam), overlapping action (`useLook`: pupils lead, the body turns five frames later).
- Impacts: camera shake + RGB split (`ImpactCamera`), a flash, an anamorphic streak, a shockwave, sparks.
- Type: tracking-collapse titles, masked line reveals, staggered word springs, per-letter 3D slams.
