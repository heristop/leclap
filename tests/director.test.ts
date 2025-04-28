import path from 'node:path';
import { ProjectConfig } from '@/core/types';
import { compile, loadConfig } from '../src';
import { main } from '@/main';

// Get absolute paths for proper configuration
const cwd = process.cwd();
const buildDir = path.resolve(cwd, 'build');
const assetsDir = path.resolve(cwd, 'src/shared/assets');

// Project Configuration
const projectConfig: ProjectConfig = {
  buildDir,
  assetsDir,
  currentLocale: 'en',
  audioConfig: {
    sampleRate: 44100,
    channelLayout: 'stereo',
  },
  videoConfig: {
    orientation: 'landscape',
    scale: '1280:720',
  },
  fields: {
    form_1_firstname: 'Firsname',
    form_1_lastname: 'Lastname',
    form_1_job: 'Tech Lead',
    form_2_keyword1: 'One',
    form_2_keyword2: 'Two',
    form_2_keyword3: 'Three',
  },
};

async function runTemplateCompilation(configName: string): Promise<string | null> {
  return await compile(projectConfig, await loadConfig(`./src/shared/templates/${configName}.json`));
}

describe('Segments', () => {
  it('should compile a picture section', async () => {
    expect(await runTemplateCompilation('picture')).not.toBeNull();
  }, 40000);

  it('should compile a video section from url successfully', async () => {
    expect(await runTemplateCompilation('video')).not.toBeNull();
  }, 40000);

  it('should compile an intertitle section with animation successfully', async () => {
    expect(await runTemplateCompilation('intertitle')).not.toBeNull();
  }, 40000);

  it('should compile a video section with a looped sound successfully', async () => {
    expect(await runTemplateCompilation('loop_music')).not.toBeNull();
  }, 40000);

  it('should compile a portrait video section', async () => {
    expect(await runTemplateCompilation('portrait')).not.toBeNull();
  }, 40000);

  it('should compile an accelerated video section', async () => {
    expect(await runTemplateCompilation('video_speed')).not.toBeNull();
  }, 40000);

  it('should compile a video with a local music', async () => {
    expect(await runTemplateCompilation('local_music')).not.toBeNull();
  }, 40000);

  it('should compile and concat background color sections', async () => {
    expect(await runTemplateCompilation('fast_and_curious')).not.toBeNull();
  }, 40000);
});

describe('Concat', () => {
  it('should concat several video sections with music mix', async () => {
    expect(await runTemplateCompilation('concat_videos_with_music')).not.toBeNull();
  }, 80000);
});

describe('Mixed Template', () => {
  it('should compile a mixed template successfully', async () => {
    expect(await main('src/shared/templates/sample.json')).not.toBeNull();
  }, 100000);
});
