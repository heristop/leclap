import 'reflect-metadata';
import { container } from 'tsyringe';
import PlatformBridge from './platform/PlatformBridge';
import TemplateDirector from './director/TemplateDirector';
import Project from './core/models/Project';
import Template from './core/models/Template';
import Segment from './core/models/Segment';
import type { ProjectConfig, TemplateDescriptor } from './core/types';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function initializePlatform(): Promise<void> {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const bridge = new PlatformBridge();
    const fileSystem = await bridge.create('filesystem');
    container.registerInstance('logger', await bridge.create('logger'));
    container.registerInstance('ffmpegAdapter', await bridge.create('ffmpeg'));
    container.registerInstance('filesystemAdapter', fileSystem);
    container.registerInstance('musicAdapter', await bridge.create('music'));

    container.registerInstance('project', new Project());
    container.registerInstance('template', new Template());
    container.registerInstance('segment', new Segment());

    const EventManager = (await import('./platform/EventManager')).default;
    container.registerInstance('eventManager', new EventManager());

    const AssetManager = (await import('./editor/managers/AssetManager')).default;
    const VariableManager = (await import('./editor/managers/VariableManager')).default;
    const MapManager = (await import('./editor/managers/MapManager')).default;
    const FilterManager = (await import('./editor/managers/FilterManager')).default;
    const FormattersManager = (await import('./editor/managers/FormatterManager')).default;

    container.register('AssetManager', { useClass: AssetManager });
    container.register('VariableManager', { useClass: VariableManager });
    container.register('MapManager', { useClass: MapManager });
    container.register('FilterManager', { useClass: FilterManager });
    container.register('FormattersManager', { useClass: FormattersManager });

    const VideoEditor = (await import('./editor/VideoEditor')).default;
    const MusicComposer = (await import('./editor/MusicComposer')).default;
    const TemplateConcreteBuilder = (await import('./director/TemplateConcreteBuilder')).default;
    const TemplateDirector = (await import('./director/TemplateDirector')).default;

    container.register('VideoEditor', { useClass: VideoEditor });
    container.register('MusicComposer', { useClass: MusicComposer });
    container.register('TemplateConcreteBuilder', { useClass: TemplateConcreteBuilder });
    container.register('TemplateDirector', { useClass: TemplateDirector });

    isInitialized = true;
  })();

  return initializationPromise;
}

export async function loadConfig(configPath: string): Promise<TemplateDescriptor> {
  await initializePlatform();

  try {
    const fileSystem = container.resolve('filesystemAdapter');
    const content = await fileSystem.read(configPath);
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

export async function compile(
  projectConfig: ProjectConfig,
  templateDescriptor: TemplateDescriptor
): Promise<string | null> {
  await initializePlatform();

  try {
    if (!projectConfig.buildDir) {
      throw new Error('buildDir is required in projectConfig');
    }

    console.log('Starting compilation with config:', {
      hasUserVideoPaths: !!projectConfig.userVideoPaths,
      videoPaths: projectConfig.userVideoPaths ? Object.keys(projectConfig.userVideoPaths) : 'none',
    });

    const director = container.resolve(TemplateDirector).config(projectConfig, templateDescriptor);
    return await director.construct();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Compilation error: ${error.message}`);
      if (error.stack) console.error('Stack:', error.stack);
    } else {
      console.error('Unknown compilation error');
    }
    return null;
  }
}

export { TemplateDirector };
export { default as VideoEditor } from './editor/VideoEditor';
export { default as FFmpegNodeAdapter } from './platform/ffmpeg/FFmpegNodeAdapter';
export { default as FFmpegWasmAdapter } from './platform/ffmpeg/FFmpegWasmAdapter';
export { default as FilesystemNodeAdapter } from './platform/filesystem/FilesystemNodeAdapter';
export { default as PinoLogAdapter } from './platform/logging/PinoLogAdapter';
export { default as AbstractFFmpeg } from './platform/ffmpeg/AbstractFFmpeg';
export { default as AbstractFilesystem } from './platform/filesystem/AbstractFilesystem';
export { default as AbstractLogger } from './platform/logging/AbstractLogger';
export { default as AbstractMusic } from './platform/ffmpeg/AbstractMusic';
export { FFmpegDetector } from './platform/ffmpeg/FFmpegDetector';
export { Terminal } from './utils/terminal';
export { container };
export type { ProjectConfig, TemplateDescriptor } from './core/types';
