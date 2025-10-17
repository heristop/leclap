import 'reflect-metadata';
import { container } from 'tsyringe';
import PlatformBridge from './platform/PlatformBridge';
import TemplateDirector from './director/TemplateDirector';
import { ProjectConfig, TemplateDescriptor } from './core/types';

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
      // Keep the original error's stack and message
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

// Return the output path string on success, null on failure
export async function compile(
  projectConfig: ProjectConfig,
  templateDescriptor: TemplateDescriptor
): Promise<string | null> {
  await initializePlatform();

  try {
    // Ensure required paths are provided and are absolute
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

// Export necessary classes and types for external use (like the server)
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
export { TerminalUI } from './utils/TerminalUI';
export { container }; // Export container for DI registration if needed externally
export type { ProjectConfig, TemplateDescriptor } from './core/types'; // Re-export types
