// Section types the director turns into actual video/audio segments. Shared between
// TemplateDirector (which filters the descriptor's sections down to these for rendering) and
// music-fade (which must not let a non-renderable section, e.g. `form`, shrink the music-fade cap
// below what the rendered sections actually allow). Single source of truth for the 4 values so the
// two lists can't drift apart.
export const VIDEO_SEGMENT_TYPES = new Set(['video', 'project_video', 'image_background', 'color_background']);
