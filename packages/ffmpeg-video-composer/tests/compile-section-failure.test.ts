import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import { SectionError } from '@/core/errors/section-error';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';

// A section that fails to build used to be skipped: its command stayed `-version`, the concat logged
// "Impossible to open" but exited 0, and compile() resolved build/output.mp4 without that section.
// Real ffmpeg, three cheap color cards; the middle one references an asset that never resolves.
const buildDir = testBuildDir('compile-section-failure');

function card(name: string, extra: Record<string, unknown> = {}) {
  return { name, type: 'color_background', options: { backgroundColor: '#202020', duration: 1 }, ...extra };
}

const descriptor = {
  global: { orientation: 'landscape', musicEnabled: false },
  sections: [
    card('intro'),
    card('broken', { inputs: [{ name: 'missing_logo', type: 'image', url: '{{ missing_logo }}' }] }),
    card('outro'),
  ],
} as unknown as TemplateDescriptor;

const projectConfig = {
  buildDir,
  currentLocale: 'en',
  audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
  videoConfig: { orientation: 'landscape', scale: '640:360' },
  fields: {},
  userVideoPaths: {},
} as unknown as ProjectConfig;

describe('compile() with a failing section', () => {
  it('fails the whole compile and reports the section and its cause', async () => {
    fs.rmSync(buildDir, { recursive: true, force: true });
    const errors: Error[] = [];

    const out = await compile(projectConfig, descriptor, { onError: (error) => errors.push(error) });

    expect(out).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(SectionError);
    expect(errors[0]).toMatchObject({ section: 'broken' });
    expect(errors[0].message).toMatch(/^Section "broken" failed: .*missing_logo/);
    expect(fs.existsSync(path.join(buildDir, 'output.mp4'))).toBe(false);
  }, 180000);
});
