# LeClap for agentic development — storyboard

A 50-second film (1920×1080, 30 fps) on one idea: **don't describe the change, show it**. Composition id:
`LeClapAgentic`. The landing-page showcase (`src/showcase/`) stays the broad cut; this one is the
focused variant for the agentic-development section of [leclap.dev](https://leclap.dev/#agentic)
and for sharing.

```bash
pnpm --filter @leclap/brand-motion render:agentic     # voice + score + picture → out/leclap-agentic.mp4
```

## Message

Taken from `docs/launch/agentic-development-use-case.md` and leclap.dev's agentic section (`/#agentic`), not invented:

- the problem: a pull request proves visual behavior with prose;
- the loop, in the page's four steps: **implement → collect evidence → render → attach**;
- composition, not generation — real recordings, a validated template, the engine composes;
- LeClap renders the artifact; the surrounding workflow attaches it (never "LeClap uploads");
- the close is the set call: _Lights, camera, merge._ (French: _Silence, on merge._)

## Shot list

| Time  | Scene    | What happens                                                                                                                                                                                                                                 | Exit                  |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 0–6   | `hook`   | A PR for the Kiln & Co. shop scrolls by as prose (“Screenshots: —”). “Your agent shipped the change. The reviewer still has to imagine it.” The squint-o-meter sits in the red. Clappy hops up, reads, winds up — and claps.                 | Clappy slams (5.8s)   |
| 6–10  | `title`  | Boom: “Don't describe the change. Show it.” Clappy free-falls in, squash, ta-da.                                                                                                                                                             | Whip pan              |
| 10–32 | `loop`   | The camera dollies along the four steps under a filling rail: the agent's log + the diff; before/after Playwright recordings with REC lit + the review focus; the template's variables, `validate_template` ✓, the engine composing; the PR. | The PR, with evidence |
| 32–43 | `review` | Play is pressed; the evidence grows out of the PR to full frame: BEFORE, the wipe, AFTER, what to review — narrated. The squint-o-meter drops on the wipe; Clappy cheers.                                                                    | Camera flies into it  |
| 43–50 | `outro`  | “Lights, camera, merge.” + three proof points; Clappy drops onto the wordmark, the address, a wink. The letterbox closes.                                                                                                                    | Iris                  |

## Evidence

Everything on screen that is a "result" is real: the shop recordings and `pr-evidence.mp4` come from
`examples/agentic-pr-video` (demo shop, `record.mjs`, `before-after.json`) rendered by the engine via
`media/render-pr-evidence.ts`. The review section's cue times in `timeline.ts` are read off that render.

## Sound

Same narrator (Kokoro `af_heart`, in both cuts), synth and keynote-minimal palette as the showcase, its
own arrangement (`audio/scores/agentic.ts`): a ticking, heartbeat hook; a focused groove on a digital marimba
through the loop with a chord hit on every step and a bell on every ✓; four-on-the-floor and the melody
entering with AFTER; the music-box motif under the logo.
