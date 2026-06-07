import 'reflect-metadata';
import { container } from 'tsyringe';
import PlatformBridge from './platform/PlatformBridge';
import TemplateDirector from './director/TemplateDirector';
import Project from './core/models/Project';
import Template from './core/models/Template';
import Segment from './core/models/Segment';
import type AbstractFilesystem from './platform/filesystem/AbstractFilesystem';
import type { ProjectConfig, TemplateDescriptor } from './core/types';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function registerAdapters(bridge: PlatformBridge): Promise<void> {
  const fileSystem = await bridge.create('filesystem');
  container.registerInstance('logger', await bridge.create('logger'));
  container.registerInstance('ffmpegAdapter', await bridge.create('ffmpeg'));
  container.registerInstance('filesystemAdapter', fileSystem);
  container.registerInstance('musicAdapter', await bridge.create('music'));
}

async function registerManagers(): Promise<void> {
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
}

async function registerEditorClasses(): Promise<void> {
  const VideoEditor = (await import('./editor/VideoEditor')).default;
  const MusicComposer = (await import('./editor/MusicComposer')).default;
  const TemplateConcreteBuilder = (await import('./director/TemplateConcreteBuilder')).default;
  const TemplateDirectorClass = (await import('./director/TemplateDirector')).default;

  container.register('VideoEditor', { useClass: VideoEditor });
  container.register('MusicComposer', { useClass: MusicComposer });
  container.register('TemplateConcreteBuilder', { useClass: TemplateConcreteBuilder });
  container.register('TemplateDirector', { useClass: TemplateDirectorClass });
}

async function initializePlatform(): Promise<void> {
  if (isInitialized) return;

  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const bridge = new PlatformBridge();

    await registerAdapters(bridge);

    container.registerInstance('project', new Project());
    container.registerInstance('template', new Template());
    container.registerInstance('segment', new Segment());

    await registerManagers();
    await registerEditorClasses();

    isInitialized = true;
  })();

  return initializationPromise;
}

export async function loadConfig(configPath: string): Promise<TemplateDescriptor> {
  await initializePlatform();

  try {
    const fileSystem = container.resolve<AbstractFilesystem>('filesystemAdapter');
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

    const director = container.resolve(TemplateDirector).config(projectConfig, templateDescriptor);

    return await director.construct();
  } catch (error) {
    if (!(error instanceof Error)) {
      console.error('Unknown compilation error');

      return null;
    }

    console.error(`Compilation error: ${error.message}`);

    if (error.stack) console.error('Stack:', error.stack);

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
