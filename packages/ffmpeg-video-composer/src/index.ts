import 'reflect-metadata';
import { container } from 'tsyringe';
import PlatformBridge from './platform/PlatformBridge';
import TemplateDirector from './director/TemplateDirector';
import Project from './core/models/Project';
import Template from './core/models/Template';
import Segment from './core/models/Segment';
import type AbstractFilesystem from './platform/filesystem/AbstractFilesystem';
import type AbstractLogger from './platform/logging/AbstractLogger';
import type { ProjectConfig, TemplateDescriptor } from './core/types';
import { getPerfTimer, resetPerfTimer } from './utils/perf-timer';
import { formatPerfReport } from './utils/perf-report';

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
  const AnimationComposer = (await import('./editor/AnimationComposer')).default;
  const TemplateConcreteBuilder = (await import('./director/TemplateConcreteBuilder')).default;
  const TemplateDirectorClass = (await import('./director/TemplateDirector')).default;

  container.register('VideoEditor', { useClass: VideoEditor });
  container.register('MusicComposer', { useClass: MusicComposer });
  container.register('AnimationComposer', { useClass: AnimationComposer });
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

// Log the per-run perf table and persist it next to the build output. No-op when FVC_PERF is
// disabled (the timer reports totalMs 0). Never throws — perf reporting must not break a compile.
async function emitPerfReport(
  logger: AbstractLogger,
  buildDir: string,
  templateDescriptor: TemplateDescriptor
): Promise<void> {
  const report = getPerfTimer().report();
  if (report.totalMs <= 0) {
    return;
  }

  logger.info(`\n${formatPerfReport(report)}`);

  try {
    const fileSystem = container.resolve<AbstractFilesystem>('filesystemAdapter');
    const data = new TextEncoder().encode(JSON.stringify(report, null, 2));
    // FVC_PERF_OUT lets a caller (the bench harness) pin an exact output path per run so reports
    // don't collide across fixtures that share a meta.name; otherwise name it from the descriptor.
    const explicit = process.env.FVC_PERF_OUT;
    if (explicit) {
      await fileSystem.writeFile(explicit, data);
      return;
    }
    const buildPath = await fileSystem.getBuildPath(buildDir);
    const name = (templateDescriptor.meta?.name ?? 'run').replace(/[^a-z0-9_-]+/gi, '_');
    await fileSystem.writeFile(`${buildPath}/perf-${name}.json`, data);
  } catch (error) {
    logger.info(`perf report write skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function compile(
  projectConfig: ProjectConfig,
  templateDescriptor: TemplateDescriptor
): Promise<string | null> {
  await initializePlatform();

  const timer = resetPerfTimer();

  try {
    if (!projectConfig.buildDir) {
      throw new Error('buildDir is required in projectConfig');
    }

    const logger = container.resolve<AbstractLogger>('logger');
    logger.info('Starting compilation', {
      hasUserVideoPaths: Boolean(projectConfig.userVideoPaths),
      videoPaths: projectConfig.userVideoPaths ? Object.keys(projectConfig.userVideoPaths) : 'none',
    });

    const director = container.resolve(TemplateDirector).config(projectConfig, templateDescriptor);

    const output = await timer.span('compile:total', () => director.construct());

    await emitPerfReport(logger, projectConfig.buildDir, templateDescriptor);

    return output;
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
export {
  TemplateDescriptorSchema,
  templateDescriptorJsonSchema,
  XFADE_TRANSITIONS,
  AFADE_CURVES,
  LOOK_PRESETS,
  TransitionSchema,
  GlobalAudioSchema,
  GradeSchema,
  MotionEffectSchema,
  BackgroundLayerSchema,
  FramingGuideSchema,
  AudioFadeSchema,
  DuckingSchema,
} from './schemas/template.schemas';
export type {
  Transition,
  GlobalAudio,
  Grade,
  MotionEffect,
  BackgroundLayer,
  FramingGuide,
} from './schemas/template.schemas';
export { OrientationSchema } from './schemas/global.schemas';
export type { Orientation } from './schemas/global.schemas';
export { CaptureModeSchema } from './schemas/section.schemas';
export type { CaptureMode } from './schemas/section.schemas';
