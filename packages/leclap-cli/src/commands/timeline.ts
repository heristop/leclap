import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import { expandPartialsSafe, videoTimeline } from 'ffmpeg-video-composer';
import { formatTimeline } from '../snapshot-args.js';
import { emitFailure } from './snapshot.js';

// `leclap timeline <template> [--json]`: where everything sits on the whole video — each section's
// absolute start/end, every motion event, beats and cues — without rendering.

export const timeline = defineCommand({
  meta: { name: 'timeline', description: 'Print a template timeline: sections, motion events, beats and cues' },
  args: {
    template: { type: 'positional', description: 'Path to a template JSON file', required: true },
    json: { type: 'boolean', description: 'Emit the timeline as JSON', default: false },
  },
  async run({ args }) {
    try {
      const expansion = expandPartialsSafe(JSON.parse(await fs.readFile(args.template, 'utf8')));

      if (!expansion.ok) throw new Error(expansion.error.message);

      const result = videoTimeline(expansion.data);

      process.stdout.write(args.json ? `${JSON.stringify(result)}\n` : `${formatTimeline(result).join('\n')}\n`);
    } catch (error) {
      emitFailure(error, args.json);
    }
  },
});
