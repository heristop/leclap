// Handwritten one-line descriptions for each built-in template, keyed by id (filename sans
// `.json`). Used by the catalog to give agents a human-readable summary of what each starting
// point produces. Ids missing here fall back to a generic string in `index.ts` (never crash).
export const templateMetadata: Record<string, string> = {
  concat_videos_with_music: 'Concatenate several video clips with a background music track',
  fast_and_curious: 'Animated colored intro cards stacked into a fast title sequence',
  intertitle: 'Title cards inserted between video clips',
  local_music: 'Single project video clip with a locally-bundled music track',
  loop_music: 'Video intro over a looping background music bed',
  picture: 'Still image background with a text overlay',
  portrait: 'Vertical (portrait) video clip for mobile feeds',
  premium_intro: 'Cinematic landscape title card: bold gold name, accent rule and subtitle on a letterboxed navy grade',
  premium_quote: 'Editorial landscape quote card: serif quotation on warm paper with gold accents and attribution',
  premium_quote_portrait: 'Vertical story quote card: gold script headline over a layered purple grade with serif body',
  premium_reel_portrait:
    'Vertical social reel cover: bold headline, red accent shapes, subtitle and handle on a dark grade',
  premium_spotlight:
    'Wraps a user clip (project_video) in a cinematic intro + outro: graded with a vignette and a gold lower-third caption from the name field',
  premium_titles:
    'Three-card landscape title sequence with fade transitions in a cohesive teal-and-charcoal brand grade',
  sample: 'Full-featured showcase: intro, form fields, project clips, intertitles, outro and music',
  video: 'Minimal single video clip pass-through',
  video_speed: 'Project video clip re-timed to a custom playback speed',
};
