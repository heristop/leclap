// Transcript words → an SRT document, grouped into the same phrases the subtitle lowering shows
// (core/captions/grouping.ts, default rules). For `leclap transcribe --srt` and transcribe_media.

import { DEFAULT_GROUP_RULES, groupWords, type GroupRules, type WordTiming } from './grouping';

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function timestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor(total / 60_000) % 60;
  const secs = Math.floor(total / 1000) % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(total % 1000, 3)}`;
}

export function transcriptSrt(words: readonly WordTiming[], rules: GroupRules = DEFAULT_GROUP_RULES): string {
  return groupWords(words, rules)
    .map((group, index) => {
      const text = group.words.map((word) => word.text).join(' ');

      return `${index + 1}\n${timestamp(group.start)} --> ${timestamp(group.end)}\n${text}\n`;
    })
    .join('\n');
}
