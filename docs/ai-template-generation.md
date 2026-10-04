# Generate templates with AI

The web template builder can draft a template from a short brief, using **your own** model provider key.
Choose **Generate with AI** in the builder's title bar (or **Or describe it and generate with AI** in the
starter picker), describe the video, and pick a provider.

## How it works

1. **Prompt.** LeClap builds the prompt from the engine itself: a condensed version of the template JSON
   Schema, the motion catalog (kinetic presets, camera, graphics, transitions, easing and time-reference
   grammar, themes, delivery platforms, genre doctrine and scene blueprints) and one or two packaged
   samples that match the brief.
2. **Generate.** The provider streams its answer, with live progress and a cancel button.
3. **Validate and repair.** The reply is parsed and checked with the same `TemplateValidator` the renderer
   uses. When it is invalid, every finding (path, code, message, and the validator's `hint` and
   `suggestion` when known) is sent back to the model, for up to three repair rounds.
4. **Open.** A summary (scenes, clips to film, duration, format, effects) is shown, then the template opens
   as a new draft. Undo restores your previous draft, and saved templates are never overwritten.

Providers run on the AI SDK and are called directly from the browser:

| Provider  | Models                                                                        |
| --------- | ----------------------------------------------------------------------------- |
| Anthropic | `claude-opus-5-5` (default), `claude-sonnet-5-5`, `claude-haiku-4-5-20251001` |
| OpenAI    | Free-text model id (default `gpt-5`), JSON mode                               |

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
