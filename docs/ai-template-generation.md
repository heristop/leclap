# Generate templates with AI

The web template builder can draft a template from a short brief, using **your own** model provider key.
Choose **Generate with AI** in the builder's title bar (or **Or describe it and generate with AI** in the
starter picker), describe the video, and pick a provider.

## How it works

1. **Prompt.** LeClap builds the prompt from the engine itself: a condensed version of the template JSON
   Schema, the motion catalog (kinetic presets, camera, graphics, transitions, easing and time-reference
   grammar, themes, delivery platforms, genre doctrine and scene blueprints) and one or two packaged
   samples that match the brief. The art direction varies the layout (edge-anchored, left-aligned,
   asymmetric and layered compositions, a centred layout on at most one beat), picks fonts from the theme
   tokens or a pairing for the genre, and adds story-spine and lazy-defaults rules.
2. **Plan first.** With **Plan first** on (the default), a small planning call returns a plan: the strategy
   ("tells <audience> that <message>"), three concepts with a typicality estimate, the chosen concept, a
   beat sheet (section, role, verb, on-screen copy, why, seconds), the theme, the platform and the primary
   and accent transitions. An invalid plan gets one repair turn; if it still fails, generation continues
   without a plan and says so. With **Review the plan** on, the run pauses on an editable beat table;
   **Write template** continues with the edited plan.
3. **Generate.** The provider streams its answer, with live progress and a cancel button.
4. **Validate and repair.** The reply is parsed and checked with the same `TemplateValidator` the renderer
   uses. When it is invalid, every finding (path, code, message, and the validator's `hint` and
   `suggestion` when known) is sent back to the model, for up to three repair rounds.
5. **Polish.** Once the template validates, the engine's advisory lint (pacing, accent overuse,
   [palette drift](./template-configuration.md#themes)) is sent back once as "improve if cheap". A polish reply
   that does not validate is discarded, so advisories never fail a run. The result card lists the remaining
   art-direction notes.
6. **Open.** A summary (scenes, clips to film, duration, format, effects) is shown, then the template opens
   as a new draft. Undo restores your previous draft, and saved templates are never overwritten.

Providers run on the AI SDK and are called directly from the browser:

| Provider  | Models                                                                        |
| --------- | ----------------------------------------------------------------------------- |
| Anthropic | `claude-opus-5-5` (default), `claude-sonnet-5-5`, `claude-haiku-4-5-20251001` |
| OpenAI    | Free-text model id (default `gpt-5`), JSON mode                               |

## Match a reference (optional)

Attach a reference image or clip under **Match a reference**. It is analysed in the browser (palette roles
with WCAG contrast, grain and pacing; see [Match a reference](./template-configuration.md#match-a-reference))
and added to both the planning and the writing prompt as binding rules: keep its palette, texture and
pacing, never copy its subjects, logos or text. Its theme takes precedence over a routed or planned theme.

## Brief routing with Jev (optional)

With a Jev (TypeSafe AI) key, LeClap first asks Jev to classify the brief: genre, platform, format,
energy, theme and the closest ready-made template, each with a confidence. Answers at 50% or more are
applied as chips you can switch off; lower ones are shown as suggestions. The chosen genre narrows the
doctrine and samples sent to the writing model, so the prompt is smaller and more relevant.

Jev picks; it doesn't write. **Start from the best match** opens the closest template with the chosen
theme, platform and format applied, for you to fill in, without any writing model. If Jev's API cannot be
reached from the browser, generation still works without it.

## Privacy

- Keys are stored only in this browser (`localStorage`, under `leclap.ai.keys.v1`; in memory when storage
  is blocked) and sent only to the provider you chose, in its authentication header.
- Keys are never sent to LeClap, never put in a URL and never logged.
- **Forget key** removes one provider's key; **Forget all keys** removes every key.
- Usage is billed to your provider account.
