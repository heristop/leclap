// The browser-agent tool names, in one dependency-free module so docs and the activity UI can list them
// without pulling the tool layer. Names shared with @leclap/mcp mean the same thing on both surfaces.

/** Phase 1: read, reference, validate and undoable edits. */
export const BUILDER_TOOL_NAMES = [
  'get_template',
  'list_sections',
  'get_template_schema',
  'get_motion_catalog',
  'list_samples',
  'get_sample',
  'validate_template',
  'get_timeline',
  'select_section',
  'edit_template',
  'add_section',
  'remove_section',
  'move_section',
  'set_texts',
  'undo',
] as const;

/** Tools later phases add (global edits, consequential actions); declared so the UI can word them. */
export const LATER_TOOL_NAMES = [
  'set_theme',
  'set_format',
  'set_music',
  'replace_template',
  'load_sample',
  'render_preview',
  'render_frames',
  'save_template',
] as const;

export type BuilderToolName = (typeof BUILDER_TOOL_NAMES)[number] | (typeof LATER_TOOL_NAMES)[number];
