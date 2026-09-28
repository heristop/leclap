import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';
import { MUSIC_TRACK_FORMATS, writeMusicTrack } from './fixtures/music-track-formats';

const execFileAsync = promisify(execFile);

// Real-compile proof that the Node loop covers the whole video whatever the track is. It used to join copies
// of the track with the concat protocol, which appends bytes and so only loops a bare MP3 stream: an MP4
// container came back one copy long, the music stopping at the track's own end, and a cover image failed
// the render, its picture stream re-encoded to an H.264 cover the mp4 muxer rejects.
const TRACK_SECONDS = 1.5;
const VIDEO_SECONDS = 3.5;

// Mean loudness of the audio in [start, start + duration], parsed from volumedetect's stderr report.
async function meanVolumeDb(filePath: string, start: number, duration: number): Promise<number> {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    filePath,
    '-vn',
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const match = stderr.match(/mean_volume: (-?[\d.]+) dB/);

  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
}

describe('music loop across track formats — real compile', () => {
  let assetsDir: string;

  beforeAll(async () => {
    assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fvc-music-formats-'));
    await fs.mkdir(path.join(assetsDir, 'musics'));

    for (const track of MUSIC_TRACK_FORMATS) {
      await writeMusicTrack(path.join(assetsDir, 'musics', `${track.name}.mp3`), track.args(TRACK_SECONDS));
    }
  });

  afterAll(async () => {
    await fs.rm(assetsDir, { recursive: true, force: true });
  });

  it.each(MUSIC_TRACK_FORMATS)(
    'keeps $format sounding past its own end',
    async ({ name }) => {
      const descriptor = {
        global: { orientation: 'landscape', musicEnabled: true, music: { name } },
        sections: [
          {
            name: 'music_formats',
            type: 'color_background',
            options: { backgroundColor: '#000000', duration: VIDEO_SECONDS },
          },
        ],
      } as unknown as TemplateDescriptor;
      const projectConfig = {
        buildDir: testBuildDir('music-loop-formats-compile'),
        assetsDir,
        currentLocale: 'en',
        audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
        videoConfig: { orientation: 'landscape', scale: '640:360' },
        fields: {},
        userVideoPaths: {},
      } as unknown as ProjectConfig;

      const output = await compile(projectConfig, descriptor);

      expect(output, 'the template should compile').not.toBeNull();
      // Past the track's own end, only a loop can still be sounding: the section's audio is a silent anullsrc
      // bed, and amix pads an input that has run out with silence (volumedetect reports ~-91 dB).
      expect(await meanVolumeDb(output as string, TRACK_SECONDS + 0.5, 1)).toBeGreaterThan(-50);
    },
    60000
  );
});
