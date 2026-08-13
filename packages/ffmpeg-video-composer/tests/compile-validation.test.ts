import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';

const buildDir = testBuildDir('compile-validation-test');

const baseConfig = () =>
  ({
    buildDir,
    assetsDir: buildDir,
    currentLocale: 'en',
    audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
    videoConfig: { orientation: 'landscape', scale: '1280:720' },
  }) as unknown as ProjectConfig;

// global is .strict(): an unknown key is schema-invalid, but the engine itself would happily
// ignore it — exactly the class of error that used to slip through the Node path.
const invalidDescriptor = {
  global: { orientation: 'landscape', musicEnabled: false, definitelyNotAField: true },
  sections: [{ type: 'color_background', name: 'card', options: { duration: 1, backgroundColor: '#204060' } }],
} as unknown as TemplateDescriptor;

describe('compile() validation gate', () => {
  it('rejects a schema-invalid descriptor', async () => {
    const out = await compile(baseConfig(), invalidDescriptor);
    expect(out).toBeNull();
  });

  it('compiles the same descriptor when skipValidation is set', async () => {
    const config = { ...baseConfig(), skipValidation: true } as ProjectConfig;
    const out = await compile(config, invalidDescriptor);
    expect(out).not.toBeNull();
  }, 120000);
});
