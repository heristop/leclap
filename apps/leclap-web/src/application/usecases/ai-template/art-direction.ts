// Prompt copy: the output contract, the builder's constraints and house art direction (genre doctrine
// and blueprints come from the engine's motion catalog). Kept apart from the prompt assembly so the
// words can be tuned without touching logic.

export const OUTPUT_CONTRACT = [
  'You write LeClap video templates. LeClap compiles a JSON template descriptor into a video with FFmpeg.',
  'Reply with exactly ONE JSON object: the complete template descriptor. No prose before or after it, no markdown fences, no comments.',
  'The object must validate against the JSON Schema at the end of this prompt.',
].join('\n');

export const BUILDER_CONSTRAINTS = [
  'Constraints (the template must open in the visual builder):',
  '- Never use sections of type "effect" or "partial".',
  '- Use "project_video" sections for the footage the user records or uploads; give each a title and description that tell them what to film.',
  '- Use "color_background" sections for title cards, chapter cards and the closing card. Put text on them with "kinetic" blocks (preferred: see the motion catalog) or "drawtext" filters; add "camera" and "graphics" where they serve the beat.',
  '- Do not reference image or video URLs; the only external files allowed are the fonts, music and animation overlays listed in the catalog.',
  '- All durations are in seconds. Give every color_background section an explicit options.duration.',
  '- Set meta.name (short), meta.description (one sentence) and meta.creativeDirection (the brief you followed).',
  '- Set global.orientation. Coordinates are in pixels of the output frame: landscape 1280x720, portrait 720x1280, square 1080x1080.',
  '- Every {{ variable }} you use must be declared in global.variables or be a form field name.',
].join('\n');

export const ART_DIRECTION = [
  'Art direction:',
  '- One idea per scene. Short, concrete copy: headlines of 2–5 words, never paragraphs.',
  '- Strong hierarchy: one large display line, at most one supporting line. Centre with x "(w-text_w)/2".',
  '- Keep text inside a safe area (8% from every edge; on portrait keep the bottom 18% clear for platform UI).',
  '- Pair a condensed display font (BebasNeue, Anton, Oswald) with a calm text font; at most two fonts.',
  '- A restrained palette: one background tone, one text colour, one accent. High contrast (WCAG AA).',
  '- Motion with purpose: stagger reveals by 0.05–0.15 s, let text settle and hold at least 1 s to be read, exit before the cut.',
  '- Vary rhythm: alternate fast cuts with a longer hold; use at most two transition types in a template.',
  '- Prefer the structured layers (kinetic, camera, graphics, look, grade, motion, transition, caption) over raw FFmpeg filters.',
  "- Follow the motion catalog rules below; they are the engine's own art direction.",
].join('\n');

// Energy 0–4 in words, for the brief.
export const ENERGY_WORDS = ['calm', 'relaxed', 'balanced', 'punchy', 'explosive'];
