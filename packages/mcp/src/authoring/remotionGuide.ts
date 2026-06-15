export const REMOTION_AUTHORING_WORKFLOW = [
  'plan_storyboard',
  'draft_template',
  'validate_template',
  'compose_video',
] as const;

export function remotionAuthoringGuide(): string {
  return [
    'Use Remotion as an authoring mental model, not as the LeClap runtime renderer.',
    '',
    'Mapping:',
    '- Remotion Composition -> LeClap TemplateDescriptor with global.orientation.',
    '- Remotion Sequence -> one LeClap section with options.duration in seconds.',
    '- Remotion AbsoluteFill background -> color_background or image_background section.',
    '- Remotion Video -> project_video when the user supplies a clip, or video when the URL is fixed.',
    '- Remotion Img -> image_background with options.pictureUrl.',
    '- Remotion text overlay -> caption for simple one-line text, or drawtext filter for custom positioning.',
    '- Remotion Audio -> global.music plus global.audio.musicVolume.',
    '- Remotion transition timing -> section.transition after the outgoing section.',
    '',
    'Rules:',
    '- Produce JSON descriptors, not TSX.',
    '- Durations are seconds in LeClap descriptors.',
    '- Prefer structured descriptor fields: caption, transition, look, grade, motion, audio, layers.',
    '- Use raw filters only when structured fields cannot express the design.',
    '- Always call validate_template before compose_video.',
  ].join('\n');
}
