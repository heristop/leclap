import { describe, expect, it } from 'vitest';
import { transcriptSrt } from '@/core/captions/transcript-srt';
import { parseSrt } from '@/core/captions/srt';

describe('transcriptSrt', () => {
  it('groups words into readable cues, formatted as SRT', () => {
    const words = [
      { text: 'Hello', start: 0.5, end: 0.9 },
      { text: 'there.', start: 1, end: 1.4 },
      { text: 'Next', start: 2.5, end: 2.9 },
      { text: 'line', start: 3, end: 3.3 },
    ];
    const srt = transcriptSrt(words);

    expect(srt).toBe('1\n00:00:00,420 --> 00:00:02,000\nHello there.\n\n2\n00:00:02,420 --> 00:00:03,900\nNext line\n');
    expect(parseSrt(srt).errors).toEqual([]);
  });

  it('is empty without words', () => {
    expect(transcriptSrt([])).toBe('');
  });
});
