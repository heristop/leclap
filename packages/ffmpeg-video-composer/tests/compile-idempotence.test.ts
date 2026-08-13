import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';

const buildDir = testBuildDir('compile-idempotence-test');

describe('compile() descriptor immutability', () => {
  it('does not mutate the caller descriptor and is repeatable', async () => {
    const descriptor: TemplateDescriptor = {
      global: { orientation: 'landscape', musicEnabled: false },
      sections: [
        {
          type: 'color_background',
          name: 'card',
          options: { backgroundColor: '#204060', duration: 1 },
          caption: {
            text: { en: 'Test' },
            position: 'center',
            style: 'bar',
          },
        },
      ],
    } as unknown as TemplateDescriptor;

    const config = {
      buildDir,
      assetsDir: buildDir,
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
    } as unknown as ProjectConfig;

    const before = JSON.stringify(descriptor);
    const first = await compile(config, descriptor);
    expect(first).not.toBeNull();
    expect(JSON.stringify(descriptor)).toBe(before);

    const second = await compile(config, descriptor);
    expect(second).not.toBeNull();
    expect(JSON.stringify(descriptor)).toBe(before);
  }, 240000);
});
