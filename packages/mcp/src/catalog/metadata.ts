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
  sample: 'Full-featured showcase: intro, form fields, project clips, intertitles, outro and music',
  video: 'Minimal single video clip pass-through',
  video_speed: 'Project video clip re-timed to a custom playback speed',
};
