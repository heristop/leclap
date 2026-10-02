# Composited effect recipes

The example descriptors include `meta.creativeDirection` with their visual intent and review criteria.
See the [creative-direction guide](../../docs/creative-direction.md) for CLI and MCP authoring.

The three effect recipes combine existing transparent APNG assets. They add useful compositions and playback defaults, rather than new generated animations or a second renderer. The same ordinary JSON inputs render through LeClap's Node, browser/WASM and native FFmpeg routes.

| Recipe              | Purpose                                      | Direction                                                                                         |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `interface-focus`   | Draw attention to an actual interface action | A restrained bracket frame and a localized tap cue. Place the cue over the recorded interaction.  |
| `product-spotlight` | Give a product detail a brief reveal         | One soft light sweep with orbiting detail highlights. Preserve readable copy and product colours. |
| `celebration-burst` | Mark a success, offer or final invitation    | A short confetti beat with a secondary sparkle. Use it once around the event.                     |

The shared creative-kit `ANIMATION_EFFECT_PRESETS` catalog describes these recipes. Each expands into two ordinary `inputs[]` entries, so saved templates retain the portable JSON contract. The app's animation library exposes the same choices alongside individual assets. Complete source cycles finish within 2.8 seconds; each preview scene then holds cleanly without the effect.

## Playback and placement

Use one-shot playback (`loop: false`, `persistent: false`) for transient overlays. The existing tap, pulse and sweep files contain visible pixels in their last frame: keeping the last frame can leave a frozen ring or glint on the footage. A frame intended to remain visible can explicitly use `persistent: true`; make that an authoring choice.

`start` is a delay in seconds. Omit it for a zero-delay input. `fps` does not retime an APNG: playback follows the file's frame delays. Likewise, `duration` can loop the source to fill the requested window; it is not a speed control. Use one play or a finite `loops` count when a complete animation matters.

Position is the top-left of the whole asset canvas, including transparent padding. In the existing 1080-square tap asset, the drawn target is centred at approximately `(540, 648)`, not at `(540, 540)`. Account for that offset when positioning it over a button. Landscape assets are 1280×720; preserve their proportions with a scale such as `"640:-1"` instead of stretching them into a square. Reposition and rescale the recipe for portrait or square output.

Keep at most two animated layers active in each recipe. Apply them within the relevant section, use cuts where appropriate, and avoid a whole-video decoration for a momentary action. Each decoded overlay consumes memory and adds compositing work, particularly in WASM and on-device renders. These recipes require no Remotion worker, remote assets or extra native FFmpeg filters.

## Preview fixture

[`preview-template.json`](./preview-template.json) contains three six-second scenes with contrasting backgrounds, bundled fonts and bundled overlays. Landscape is the default. It needs no user footage. The illustrative target and product panel are synthetic shapes, not a captured product interface. Their positions and sizes use frame-relative expressions: the target is centred at 50% of the width and 52% of the height; the title and footer stay separate from it.

For portrait or square previews, set `global.orientation` to the desired output and rebuild each section's `inputs` from its shared preset's `build(orientation)` result. The resulting concrete overlay coordinates match that output's dimensions; the fixture's background shapes and text positions adapt through their expressions. Inspect all three orientations without moving the labels onto the target.

For a Node render, use `packages/leclap-creative-kit/src/library` as `ProjectConfig.assetsDir`, the fixture as the descriptor, and a separate output directory. The fixture's `/assets/animations/` paths also match the staged web and Expo asset paths. Inspect the entrance, strongest effect frame, completion and the clear hold after each one-shot overlay. Check both bright and dark backgrounds for unwanted opacity, clipped artwork and a frozen last frame.

To adapt this fixture to actual footage, replace the colour background with a video section and place the effect over a verified interaction or product detail. Keep copy clear of the effect and important controls. Validate the final descriptor and inspect its rendered motion before export.
