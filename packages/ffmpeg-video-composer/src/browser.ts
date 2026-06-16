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
let initializationPromise: Promise<void> | null = null;

async function registerAdapters(logger: AbstractLogger): Promise<void> {
  const fileSystem = new BrowserFilesystemAdapter();
  const ffmpegAdapter = new FFmpegWasmAdapter(fileSystem);

  await ffmpegAdapter.waitForReady();
  logger.info('FFmpeg WASM adapter ready');

  const musicAdapter = new MusicWasmAdapter();

  container.registerInstance('ffmpegAdapter', ffmpegAdapter);
  container.registerInstance('filesystemAdapter', fileSystem);
  container.registerInstance('musicAdapter', musicAdapter);
}

function registerServices(): void {
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
}

async function initializeBrowserPlatform(): Promise<void> {
  if (isInitialized) return;

  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const logger = new BrowserLogger();

      container.registerInstance('logger', logger);

      await registerAdapters(logger);
      registerServices();

      logger.info('Browser platform initialized');
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize browser platform:', error);

      throw error;
    }
  })();

  return initializationPromise;
}

function validateTemplate(template: Template, templateDescriptor: TemplateDescriptor): void {
  const templateValidation = template.setDescriptor(templateDescriptor);

  if (!templateValidation.success) {
    const errorMessage = templateValidation.errors?.map((e) => e.message).join(', ') ?? 'Invalid template descriptor';

    throw new Error(`Template validation failed: ${errorMessage}`);
  }
}

interface ResolvedAdapters {
  eventManager: BrowserEventManager;
  logger: AbstractLogger;
  ffmpegAdapter: FFmpegWasmAdapter;
  filesystemAdapter: BrowserFilesystemAdapter;
  musicAdapter: MusicWasmAdapter;
}

interface CompilationContext extends ResolvedAdapters {
  project: Project;
  template: Template;
}

function resolveDirectorViaDI(): TemplateDirector {
  container.resolve(MusicComposer);
  container.resolve(TemplateConcreteBuilder);
  const director = container.resolve(TemplateDirector);

  console.log('[Browser Compile] Used DI container for instantiation');

  return director;
}

function resolveDirectorManually(ctx: CompilationContext): TemplateDirector {
  const { eventManager, logger, ffmpegAdapter, filesystemAdapter, project, template } = ctx;

  const musicComposer = new MusicComposer(project, template, logger, ffmpegAdapter, filesystemAdapter);
  const videoEditor = new VideoEditor(project, template, musicComposer, logger, ffmpegAdapter, filesystemAdapter);
  const concreteBuilder = new TemplateConcreteBuilder(project, logger, ffmpegAdapter, filesystemAdapter);

  const director = new TemplateDirector(eventManager, videoEditor, {
    concreteBuilder,
    musicComposer,
    project,
    template,
    logger,
    ffmpegAdapter,
    filesystemAdapter,
  });

  console.log('[Browser Compile] Created instances with manual instantiation');

  return director;
}

function resolveDirector(ctx: CompilationContext): TemplateDirector {
  try {
    return resolveDirectorViaDI();
  } catch (diError) {
    console.warn('[Browser Compile] DI container failed, falling back to manual instantiation:', diError);

    return resolveDirectorManually(ctx);
  }
}

function prepareDirector(ctx: CompilationContext): TemplateDirector {
  const { project, template } = ctx;

  container.registerInstance('project', project);
  container.registerInstance('template', template);
  container.registerInstance('segment', new Segment());

  return resolveDirector(ctx);
}

interface CompilationListeners {
  // Reads any error captured from a `task-stopped` event during compilation.
  getError: () => unknown;
  // Removes the listeners from the singleton emitter.
  detach: () => void;
}

function attachCompilationListeners(
  emitter: ReturnType<BrowserEventManager['connect']>,
  onProgress?: (progress: number) => void
): CompilationListeners {
  let compilationError: unknown = null;
  const onStopped = (err: unknown): void => {
    compilationError = err;
  };
  // Forward the director's per-segment progress (0..1) to the caller so the UI
  // can animate in real time instead of sitting frozen between coarse stages.
  const onProgressEvent = (fraction: unknown): void => {
    onProgress?.(typeof fraction === 'number' ? fraction : 0);
  };
  emitter.on('task-stopped', onStopped);
  emitter.on('compilation-progress', onProgressEvent);

  return {
    getError: () => compilationError,
    // The event manager is a singleton; remove our listeners so they don't
    // accumulate (and double-fire) across successive compilations.
    detach: () => {
      emitter.off?.('task-stopped', onStopped);
      emitter.off?.('compilation-progress', onProgressEvent);
    },
  };
}

async function runCompilation(
  projectConfig: ProjectConfig,
  templateDescriptor: TemplateDescriptor,
  ctx: CompilationContext,
  onProgress?: (progress: number) => void
): Promise<string> {
  const director = prepareDirector(ctx);

  const emitter = ctx.eventManager.connect();
  const { getError, detach } = attachCompilationListeners(emitter, onProgress);

  director.config(projectConfig, templateDescriptor);

  try {
    const outputPath = await director.construct();

    if (!outputPath) {
      const compilationError = getError();

      if (compilationError) {
        throw compilationError;
      }

      throw new Error('Video compilation failed - no output generated');
    }

    return outputPath;
  } finally {
    detach();
  }
}

export async function compileBrowser(
  projectConfig: ProjectConfig,
  templateDescriptor: TemplateDescriptor,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    await initializeBrowserPlatform();

    const ctx: CompilationContext = {
      eventManager: container.resolve<BrowserEventManager>('eventManager'),
      logger: container.resolve<AbstractLogger>('logger'),
      ffmpegAdapter: container.resolve<FFmpegWasmAdapter>('ffmpegAdapter'),
      filesystemAdapter: container.resolve<BrowserFilesystemAdapter>('filesystemAdapter'),
      musicAdapter: container.resolve<MusicWasmAdapter>('musicAdapter'),
      project: new Project(),
      template: new Template(),
    };

    validateTemplate(ctx.template, templateDescriptor);

    return await runCompilation(projectConfig, templateDescriptor, ctx, onProgress);
  } catch (error) {
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
