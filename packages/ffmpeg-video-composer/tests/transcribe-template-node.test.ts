import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clipOfSection,
  transcribeTemplate,
  type LooseSection,
} from '@/services/transcribe-node/transcribe-template-node';
import type { TranscriptionService } from '@/director/transcribe-sections';

let assets: string;

beforeEach(() => {
  assets = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-template-'));
  fs.mkdirSync(path.join(assets, 'videos'));
  fs.writeFileSync(path.join(assets, 'videos', 'talk.mp4'), 'clip');
  fs.writeFileSync(path.join(assets, 'interview.mp4'), 'clip');
});

afterEach(() => {
  fs.rmSync(assets, { recursive: true, force: true });
});

function service(): TranscriptionService & { transcribe: ReturnType<typeof vi.fn> } {
  return {
    transcribe: vi.fn(async () => ({
      engine: 'whisper.cpp',
      model: 'base',
      language: 'en',
      words: [{ text: 'Hello', start: 0.5, end: 0.9, confidence: 0.9 }],
    })),
    digest: async () => 'sha256:clip',
  };
}

function descriptor(sections: LooseSection[], meta?: unknown): { meta?: unknown; sections: LooseSection[] } {
  return { ...(meta ? { meta } : {}), sections };
}

describe('clipOfSection', () => {
  it('finds bound recordings, local videoUrls and the assets-dir fallback', () => {
    const recordings = { talk: '/rec/talk.mov' };
    const options = { assetsDir: assets, userVideoPaths: recordings, exists: (file: string) => file !== '/nope.mp4' };

    expect(clipOfSection({ name: 'talk', type: 'project_video' }, options)).toBe('/rec/talk.mov');
    expect(clipOfSection({ name: 'b', type: 'video', options: { videoUrl: 'interview.mp4' } }, options)).toBe(
      path.join(assets, 'interview.mp4')
    );
    expect(clipOfSection({ name: 'c', type: 'video', options: { useVideoSection: 'talk' } }, options)).toBe(
      '/rec/talk.mov'
    );
    expect(clipOfSection({ name: 'talk', type: 'video' }, { assetsDir: assets })).toBe(
      path.join(assets, 'videos', 'talk.mp4')
    );
    expect(() =>
      clipOfSection({ name: 'd', type: 'video', options: { videoUrl: 'https://x.test/a.mp4' } }, options)
    ).toThrow(/remote videoUrl/);
  });
});

describe('transcribeTemplate', () => {
  it('pins every request with the requested language and model', async () => {
    const host = service();
    const input = descriptor([{ name: 'talk', type: 'video', subtitles: { transcribe: {} } }]);
    const result = await transcribeTemplate(input, { assetsDir: assets, language: 'fr', model: 'tiny', service: host });

    expect(host.transcribe).toHaveBeenCalledWith(path.join(assets, 'videos', 'talk.mp4'), {
      language: 'fr',
      model: 'tiny',
    });
    expect(result.descriptor.sections[0].subtitles).toEqual({
      words: [{ text: 'Hello', start: 0.5, end: 0.9, confidence: 0.9 }],
    });
    expect(result.pins.map((pin) => pin.section)).toEqual(['talk']);
  });

  it('re-transcribes a pinned section only with force', async () => {
    const pinned = descriptor(
      [{ name: 'talk', type: 'video', subtitles: { words: [{ text: 'Old', start: 0, end: 0.2 }] } }],
      {
        resolved: {
          transcripts: { talk: { from: 'talk', engine: 'whisper.cpp', language: 'en', digest: 'sha256:old' } },
        },
      }
    );
    const host = service();
    const kept = await transcribeTemplate(pinned, { assetsDir: assets, service: host });

    expect(kept.pins).toEqual([]);
    expect(kept.stale).toEqual([expect.objectContaining({ code: 'transcript_stale' })]);

    const redone = await transcribeTemplate(pinned, { assetsDir: assets, service: host, force: true });

    expect(host.transcribe).toHaveBeenCalledWith(expect.any(String), { language: 'en' });
    expect(redone.descriptor.sections[0].subtitles).toEqual({ words: [expect.objectContaining({ text: 'Hello' })] });
    expect(redone.stale).toEqual([]);
  });

  it('limits the pass to the named section', async () => {
    const host = service();
    const input = descriptor([
      { name: 'talk', type: 'video', subtitles: { transcribe: {} } },
      { name: 'b', type: 'video', options: { videoUrl: 'interview.mp4' }, subtitles: { transcribe: {} } },
    ]);
    const result = await transcribeTemplate(input, { assetsDir: assets, sections: ['b'], service: host });

    expect(result.pins.map((pin) => pin.section)).toEqual(['b']);
    expect(result.descriptor.sections[0].subtitles).toEqual({ transcribe: {} });
  });
});
