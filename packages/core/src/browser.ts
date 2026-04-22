// Browser entry point - excludes Node.js-specific code
import 'reflect-metadata';
import { container } from 'tsyringe';
import TemplateDirector from './director/TemplateDirector';
import TemplateConcreteBuilder from './director/TemplateConcreteBuilder';
import BrowserFilesystemAdapter from './platform/filesystem/BrowserFilesystemAdapter';
import FFmpegWasmAdapter from './platform/ffmpeg/FFmpegWasmAdapter';
import MusicWasmAdapter from './platform/ffmpeg/MusicWasmAdapter';
import AssetManager from './editor/managers/AssetManager';
import VariableManager from './editor/managers/VariableManager';
import MapManager from './editor/managers/MapManager';
import FilterManager from './editor/managers/FilterManager';
import FormattersManager from './editor/managers/FormatterManager';
import Segment from './core/models/Segment';
import AbstractLogger from './platform/logging/AbstractLogger';
import BrowserEventManager from './platform/BrowserEventManager';
import VideoEditor from './editor/VideoEditor';
import MusicComposer from './editor/MusicComposer';
import Project from './core/models/Project';
import Template from './core/models/Template';
import type { ProjectConfig, TemplateDescriptor } from './core/types';

class BrowserLogger extends AbstractLogger {
  debug(message: string): void {
    console.debug(`[FFmpeg Video Composer] ${message}`);
  }

  log(message: string): void {
    console.log(`[FFmpeg Video Composer] ${message}`);
  }

  error(message: string): void {
    console.error(`[FFmpeg Video Composer] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[FFmpeg Video Composer] ${message}`);
  }

  info(message: string): void {
    console.info(`[FFmpeg Video Composer] ${message}`);
  }
}

let isInitialized = false;
let initializationPromise = null;

async function initializeBrowserPlatform(): Promise<void> {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const fileSystem = new BrowserFilesystemAdapter();
      const logger = new BrowserLogger();

      logger.info('Initializing FFmpeg WASM adapter...');
      const ffmpegAdapter = new FFmpegWasmAdapter(fileSystem);

      logger.info('Waiting for FFmpeg WASM to be ready...');
      await ffmpegAdapter.waitForReady();
      logger.info('FFmpeg WASM adapter fully loaded and ready');

      const musicAdapter = new MusicWasmAdapter();

      container.registerInstance('logger', logger);
      container.registerInstance('ffmpegAdapter', ffmpegAdapter);
      container.registerInstance('filesystemAdapter', fileSystem);
      container.registerInstance('musicAdapter', musicAdapter);

      container.register('AssetManager', { useClass: AssetManager });
      container.register('VariableManager', { useClass: VariableManager });
      container.register('MapManager', { useClass: MapManager });
      container.register('FilterManager', { useClass: FilterManager });
      container.register('FormattersManager', { useClass: FormattersManager });

      const eventManager = new BrowserEventManager();
      container.registerInstance('eventManager', eventManager);

      container.register('VideoEditor', { useClass: VideoEditor });
      container.register('MusicComposer', { useClass: MusicComposer });
      container.register('TemplateConcreteBuilder', { useClass: TemplateConcreteBuilder });
      container.register('TemplateDirector', { useClass: TemplateDirector });

      logger.info('Browser platform initialized with all dependencies');
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize browser platform:', error);
      throw error;
    }
  })();

  return initializationPromise;
}

export async function compileBrowser(
  projectConfig: ProjectConfig,
  templateDescriptor: TemplateDescriptor
): Promise<string | null> {
  try {
    console.log('[Browser Compile] Starting sophisticated video compilation with:', {
      projectConfig,
      templateDescriptor,
      userVideos: Object.keys(projectConfig.userVideoPaths || {}).length,
    });

    await initializeBrowserPlatform();

    const eventManager = container.resolve<BrowserEventManager>('eventManager');
    const logger = container.resolve<AbstractLogger>('logger');
    const ffmpegAdapter = container.resolve<FFmpegWasmAdapter>('ffmpegAdapter');
    const filesystemAdapter = container.resolve<BrowserFilesystemAdapter>('filesystemAdapter');
    const musicAdapter = container.resolve<MusicWasmAdapter>('musicAdapter');

    const project = new Project();
    const template = new Template();

    console.log('[Browser] Setting template descriptor:', templateDescriptor);
    const templateValidation = template.setDescriptor(templateDescriptor);
    console.log('[Browser] Template validation result:', templateValidation);

    if (!templateValidation.success) {
      console.error('[Browser] Template validation failed:', templateValidation);
      const errorMessage = templateValidation.errors?.map((e) => e.message).join(', ') || 'Invalid template descriptor';
      throw new Error(`Template validation failed: ${errorMessage}`);
    }

    console.log('[Browser] Template descriptor set:', template.descriptor);

    container.registerInstance('project', project);
    container.registerInstance('template', template);
    container.registerInstance('segment', new Segment());

    let musicComposer: MusicComposer;
    let videoEditor: VideoEditor;
    let concreteBuilder: TemplateConcreteBuilder;
    let director: TemplateDirector;

    try {
      musicComposer = container.resolve(MusicComposer);
      concreteBuilder = container.resolve(TemplateConcreteBuilder);
      director = container.resolve(TemplateDirector);

      console.log('[Browser Compile] Used DI container for instantiation');
    } catch (diError) {
      console.warn('[Browser Compile] DI container failed, falling back to manual instantiation:', diError);

      musicComposer = new MusicComposer(project, template, logger, ffmpegAdapter, filesystemAdapter, musicAdapter);
      videoEditor = new VideoEditor(project, template, musicComposer, logger, ffmpegAdapter, filesystemAdapter);
      concreteBuilder = new TemplateConcreteBuilder(project, logger, ffmpegAdapter, filesystemAdapter);

      director = new TemplateDirector(
        eventManager,
        concreteBuilder,
        musicComposer,
        videoEditor,
        project,
        template,
        logger,
        ffmpegAdapter,
        filesystemAdapter
      );

      console.log('[Browser Compile] Created instances with manual instantiation');
    }

    console.log('[Browser Compile] TemplateDirector created with all dependencies');

    let compilationError: unknown = null;
    // eventManager is already resolved above
    eventManager.connect().on('task-stopped', (err) => {
      compilationError = err;
    });

    director.config(projectConfig, templateDescriptor);
    const outputPath = await director.construct();

    // Remove listener to avoid leaks?
    // eventManager.connect().off('task-stopped', errorListener); // If EventEmitter supports off with listener

    if (!outputPath) {
      if (compilationError) {
        throw compilationError;
      }
      throw new Error('Video compilation failed - no output generated');
    }

    console.log('[Browser Compile] Video compilation completed:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('[Browser Compile] Compilation failed:', error);
    throw new Error(`Browser video compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export { default as FFmpegWasmAdapter } from './platform/ffmpeg/FFmpegWasmAdapter';
export { default as BrowserFilesystemAdapter } from './platform/filesystem/BrowserFilesystemAdapter';
export { default as AbstractFFmpeg } from './platform/ffmpeg/AbstractFFmpeg';
export { default as AbstractFilesystem } from './platform/filesystem/AbstractFilesystem';
export { default as AbstractLogger } from './platform/logging/AbstractLogger';
export { default as Template } from './core/models/Template';
export { default as Project } from './core/models/Project';
export { default as Segment } from './core/models/Segment';
export type { ProjectConfig, TemplateDescriptor, Variables, Section, Filter } from './core/types';
export { container } from 'tsyringe';
export { compileBrowser as compile };
