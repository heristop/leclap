import { describe, expect, it, vi } from 'vitest';
import { pinTranscript, staleTranscripts } from '@/core/captions/transcript-pin';
import { resolveTranscripts, type TranscriptionDeps } from '@/director/transcription';
import type { Transcript } from '@/core/captions/transcript';

const RECORD = {
  from: 'talk',
  engine: 'whisper.cpp',
  model: 'base',
  language: 'en',
  digest: 'sha256:aaa',
  at: '2026-10-07T10:00:00.000Z',
};

function descriptor(subtitles: Record<string, unknown> = { transcribe: { from: 'self' }, style: 'loud' }) {
  return {
    meta: { name: 'Talk' },
    sections: [
      { name: 'intro', type: 'color_background', options: { duration: 1 } },
      { name: 'talk', type: 'video', options: { videoUrl: 'talk.mp4', clip: { from: 1 } }, subtitles },
    ],
  };
}

describe('pinTranscript', () => {
  it('replaces the request with the words and records how they were made', () => {
    const words = [{ text: 'Hi', start: 0, end: 0.3, confidence: 0.8 }];
    const pinned = pinTranscript(descriptor(), 1, words, RECORD);

    expect(pinned.sections[1].subtitles).toEqual({ style: 'loud', words });
    expect(pinned.meta).toEqual({ name: 'Talk', resolved: { transcripts: { talk: RECORD } } });
  });

  it('leaves the input untouched', () => {
    const input = descriptor();

    pinTranscript(input, 1, [], RECORD);

    expect(input.sections[1].subtitles).toEqual({ transcribe: { from: 'self' }, style: 'loud' });
    expect(input.meta).toEqual({ name: 'Talk' });
  });
});

describe('staleTranscripts', () => {
  it('reports a pin whose clip changed', () => {
    const pinned = pinTranscript(descriptor(), 1, [{ text: 'Hi', start: 0, end: 0.3 }], RECORD);

    expect(staleTranscripts(pinned, { talk: 'sha256:aaa' })).toEqual([]);
    expect(staleTranscripts(pinned, { talk: 'sha256:bbb' })).toEqual([
      expect.objectContaining({ code: 'transcript_stale', path: 'meta.resolved.transcripts.talk', severity: 'warn' }),
    ]);
    expect(staleTranscripts(pinned, {})).toEqual([]);
  });
});

function deps(transcript: Partial<Transcript> = {}): TranscriptionDeps & { transcribe: ReturnType<typeof vi.fn> } {
  return {
    transcribe: vi.fn(async () => ({
      engine: 'whisper.cpp',
      model: 'base',
      language: 'en',
      words: [
        { text: 'skipped', start: 0.2, end: 0.6, confidence: 0.9 },
        { text: 'Hello', start: 1.5, end: 1.9, confidence: 0.8 },
      ],
      ...transcript,
    })),
    sourceOf: vi.fn(async (name: string) => `/clips/${name}.mp4`),
    editOf: (section) => ({ from: (section.options as { clip?: { from?: number } }).clip?.from }),
    digestOf: vi.fn(async () => 'sha256:ccc'),
    now: () => '2026-10-07T12:00:00.000Z',
  };
}

describe('resolveTranscripts', () => {
  it('transcribes the source clip, maps it to section time and pins it', async () => {
    const host = deps();
    const { descriptor: pinned, pins } = await resolveTranscripts(descriptor(), host);

    expect(host.transcribe).toHaveBeenCalledWith('/clips/talk.mp4', { from: 'self' });
    expect(pinned.sections[1].subtitles).toEqual({
      style: 'loud',
      words: [{ text: 'Hello', start: 0.5, end: 0.9, confidence: 0.8 }],
    });
    expect(pins).toEqual([
      {
        section: 'talk',
        record: {
          from: 'talk',
          engine: 'whisper.cpp',
          model: 'base',
          language: 'en',
          digest: 'sha256:ccc',
          at: '2026-10-07T12:00:00.000Z',
          confidence: 0.8,
        },
        words: 1,
      },
    ]);
  });

  it('passes the requested language and model through', async () => {
    const host = deps();

    await resolveTranscripts(descriptor({ transcribe: { language: 'fr', model: 'tiny' } }), host);

    expect(host.transcribe).toHaveBeenCalledWith('/clips/talk.mp4', { language: 'fr', model: 'tiny' });
  });

  it('degrades coarse (phrase-timed) transcripts to plain captions', async () => {
    const { descriptor: pinned } = await resolveTranscripts(
      descriptor({ transcribe: {}, karaoke: 'word' }),
      deps({ coarse: true })
    );

    expect(pinned.sections[1].subtitles).toMatchObject({ karaoke: false });
  });

  it('fails clearly when the clip cannot be found', async () => {
    const host = deps();
    host.sourceOf = async () => null;

    await expect(resolveTranscripts(descriptor(), host)).rejects.toThrow(/talk.*no clip/);
  });

  it('is a no-op without requests', async () => {
    const host = deps();
    const input = descriptor({ words: [] });

    expect((await resolveTranscripts(input, host)).descriptor).toBe(input);
    expect(host.transcribe).not.toHaveBeenCalled();
  });
});
