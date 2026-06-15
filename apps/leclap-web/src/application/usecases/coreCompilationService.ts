// Browser/WASM compilation service backed by the core package.
import 'reflect-metadata';
import { compileBrowser as compile, container } from 'ffmpeg-video-composer/src/browser.ts';
import { FONTS } from '@leclap/creative-kit/fonts';
import BrowserFilesystemAdapter from 'ffmpeg-video-composer/src/platform/filesystem/BrowserFilesystemAdapter.ts';
import type AbstractEventManager from 'ffmpeg-video-composer/src/platform/AbstractEventManager.ts';
import type { ProjectConfig, TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';

// VideoConfig isn't exported from core types; derive it from the ProjectConfig field so the
// preview-render path can pass a reduced scale without a core change.
type VideoConfigOverride = NonNullable<ProjectConfig['videoConfig']>;
import { type Template } from '@/services/templateService';
import { compilationLogger } from '@/lib/logger';
import { applyVideoEdits, type VideoEdit } from '@/domain/valueObjects/videoEdits';
import { browserMediaService } from '@/services/browserMediaService';
import { materializeTemplateMedia } from '@/application/usecases/materializeTemplateMedia';
import { applyMediaChoices, type MediaChoices } from '@/application/usecases/applyMediaChoices';
import { materializeTemplatePartials } from '@/services/templatePartialService';
import { renderQuip } from '@leclap/creative-kit/renderQuips';

export type { MediaChoices };

export interface CompilationConfig {
  template: Template;
  formData: Record<string, string>;
  files: File[];
  // Per-clip trim/crop, keyed by project_video section name. Applied client-side (ffmpeg.wasm)
  // before compilation.
  videoEdits?: Record<string, VideoEdit | undefined>;
  // Music and background selections from the Builder Media step.
  mediaChoices?: MediaChoices;
  // Optional render-config override. The builder's "Preview render" passes a reduced scale
  // (480p-equivalent) so authors see a fast draft; production compiles leave it undefined and
  // fall back to the engine defaults.
  videoConfig?: VideoConfigOverride;
}

export interface CompilationProgress {
  stage: string;
  percentage: number;
  currentStep: string;
  totalSteps: number;
  currentStepIndex: number;
  estimatedTimeRemaining?: number;
}

export interface CompilationResult {
  blob: Blob;
  url: string;
  size: number;
  duration?: number;
}

class CoreCompilationService {
  private readonly filesystemAdapter = new BrowserFilesystemAdapter();

  async compileVideo(
    config: CompilationConfig,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<CompilationResult> {
    const { template, formData, files, videoEdits, mediaChoices, videoConfig } = config;

    try {
      onProgress({
        stage: 'Initializing',
        percentage: 5,
        currentStep: 'Initializing',
        totalSteps: 7,
        currentStepIndex: 1,
      });

      await this.filesystemAdapter.clear();

      const materializedTemplate = { ...template, descriptor: materializeTemplatePartials(template.descriptor) };
      const clipSectionNames = this.projectVideoSectionNames(materializedTemplate);

      const editedFiles = await this.applyEdits(files, videoEdits, clipSectionNames, onProgress);

      const userVideoPaths = await this.storeUploadedFiles(editedFiles, clipSectionNames, onProgress);

      const projectConfig = await this.setupProjectConfig(userVideoPaths, formData, onProgress, videoConfig);

      // Pre-load bundled TTF fonts so drawtext works in WASM: the WASM
      // ffmpeg-core's freetype cannot decode the woff2 that Google Fonts serves
      // ("Could not load font: unimplemented feature"). With the TTF already in
      // place, fetchFonts() finds it cached and skips the (unusable) woff2 fetch.
      await this.preloadBundledFonts();

      const templateDescriptor = this.prepareTemplateDescriptor(materializedTemplate, formData, userVideoPaths, onProgress);

      if (mediaChoices) {
        applyMediaChoices(templateDescriptor, mediaChoices);
      }

      await materializeTemplateMedia(templateDescriptor, browserMediaService, this.filesystemAdapter);
      await this.preloadBundledMusic(templateDescriptor);

      const outputPath = await this.runCompilation(projectConfig, templateDescriptor, onProgress);

      const result = await this.finalizeResult(outputPath, onProgress);

      await this.cleanupFiles(outputPath, userVideoPaths);

      return result;
    } catch (error) {
      compilationLogger.error('Compilation error:', error);

      throw new Error(`Video compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cooperatively stop an in-flight compilation. The engine's TemplateDirector listens for
  // `task-cancelled` on the shared event manager and flips its stop flag, so the build halts at the
  // next segment boundary instead of running to completion. Safe to call when nothing is running:
  // the container resolve just throws (engine not initialised yet) and we swallow it.
  cancel(): void {
    try {
      const eventManager = container.resolve<AbstractEventManager>('eventManager');
      eventManager.connect().emit('task-cancelled');
    } catch (error) {
      compilationLogger.warn('Cancel requested before the engine was ready:', error);
    }
  }

  // Bundled TTF fonts (served from /public/fonts) loaded into the build dir so
  // WASM drawtext can use them instead of the unsupported Google-Fonts woff2.
  private async preloadBundledFonts(): Promise<void> {
    const fonts = FONTS.map((f) => f.file);
    const fontsDir = '/tmp/build/fonts';

    await this.filesystemAdapter.ensureDir(fontsDir);
    await Promise.all(
      fonts.map(async (font) => {
        try {
          const response = await fetch(`/fonts/${font}`);

          if (!response.ok) {
            return;
          }

          const data = new Uint8Array(await response.arrayBuffer());
          await this.filesystemAdapter.writeFile(`${fontsDir}/${font}`, data);
        } catch {
          // Best-effort: fall back to the remote font fetch if the bundle is missing.
        }
      })
    );
  }

  // Bundled background track (served from /public/musics) loaded into the assets dir so WASM music
  // mixing finds it locally — mirrors preloadBundledFonts. Without this, a name-only `global.music`
  // has no file to mix and the compile fails (there is no Google-Fonts-style remote fallback).
  private async preloadBundledMusic(descriptor: TemplateDescriptor): Promise<void> {
    const name = descriptor.global?.music?.name;

    if (descriptor.global?.musicEnabled !== true || !name) {
      return;
    }

    const file = name.endsWith('.mp3') ? name : `${name}.mp3`;
    const musicsDir = '/assets/musics';

    try {
      const response = await fetch(`/musics/${file}`);

      if (!response.ok) {
        return;
      }

      await this.filesystemAdapter.ensureDir(musicsDir);
      await this.filesystemAdapter.writeFile(`${musicsDir}/${file}`, new Uint8Array(await response.arrayBuffer()));
    } catch {
      // Best-effort: a missing bundled track just means no music, not a failed render.
    }
  }

  private async applyEdits(
    files: File[],
    videoEdits: Record<string, VideoEdit | undefined> | undefined,
    sectionNames: string[],
    onProgress: (progress: CompilationProgress) => void
  ): Promise<File[]> {
    if (!videoEdits) {
      return files;
    }

    return applyVideoEdits(files, videoEdits, sectionNames, ({ index, total }) => {
      onProgress({
        stage: 'Editing',
        percentage: 8,
        currentStep: `Applying trim/crop to clip ${index + 1} of ${total}`,
        totalSteps: 7,
        currentStepIndex: 1,
      });
    });
  }

  // The ordered `project_video` section names of a template — each user clip maps to one, in order,
  // so clips are stored under the section's real name (e.g. `video_1`, `intro_clip`) rather than a
  // positional `video_N`. This is what the descriptor's `project_video` sections reference.
  private projectVideoSectionNames(template: Template): string[] {
    const sections = (template.descriptor.sections ?? []) as Array<{ name: string; type: string }>;

    return sections.filter((s) => s.type === 'project_video').map((s) => s.name);
  }

  private async storeUploadedFiles(
    files: File[],
    sectionNames: string[],
    onProgress: (progress: CompilationProgress) => void
  ): Promise<Record<string, string>> {
    onProgress({
      stage: 'Preparing',
      percentage: 15,
      currentStep: 'Loading video files into browser storage',
      totalSteps: 7,
      currentStepIndex: 2,
    });

    const entries = files.map((file, i) => {
      const key = sectionNames[i] ?? `video_${i + 1}`;
      const fileName = `${key}.${file.name.split('.').pop() ?? 'mp4'}`;
      const storagePath = `/tmp/${fileName}`;

      return { file, key, storagePath };
    });

    await Promise.all(entries.map(({ file, storagePath }) => this.filesystemAdapter.storeFile(file, storagePath)));

    const userVideoPaths: Record<string, string> = {};

    for (const [i, entry] of entries.entries()) {
      userVideoPaths[entry.key] = entry.storagePath;
      onProgress({
        stage: 'Preparing',
        percentage: 15 + ((i + 1) * 20) / files.length,
        currentStep: `Loaded ${entry.file.name} (${this.formatFileSize(entry.file.size)})`,
        totalSteps: 7,
        currentStepIndex: 2,
      });
    }

    return userVideoPaths;
  }

  private async setupProjectConfig(
    userVideoPaths: Record<string, string>,
    formData: Record<string, string>,
    onProgress: (progress: CompilationProgress) => void,
    videoConfig?: VideoConfigOverride
  ): Promise<ProjectConfig> {
    onProgress({
      stage: 'Configuring',
      percentage: 40,
      currentStep: 'Setting up project configuration',
      totalSteps: 7,
      currentStepIndex: 3,
    });

    const buildDir = '/tmp/build';
    await this.filesystemAdapter.ensureDir(buildDir);

    // Project merges this over the engine defaults, so a partial { scale } override just lowers the
    // render resolution while orientation/setsar keep their defaults.
    return { buildDir, userVideoPaths, fields: formData, ...(videoConfig ? { videoConfig } : {}) };
  }

  private prepareTemplateDescriptor(
    template: Template,
    formData: Record<string, string>,
    userVideoPaths: Record<string, string>,
    onProgress: (progress: CompilationProgress) => void
  ): TemplateDescriptor {
    onProgress({
      stage: 'Processing',
      percentage: 50,
      currentStep: 'Parsing template and applying effects',
      totalSteps: 7,
      currentStepIndex: 4,
    });

    const templateDescriptor = this.convertToTemplateDescriptor(template, formData);

    compilationLogger.log('Starting core compilation with:', {
      userVideoPaths: Object.keys(userVideoPaths),
      templateId: template.id,
      formData,
      templateDescriptor,
    });

    return templateDescriptor;
  }

  private async runCompilation(
    projectConfig: ProjectConfig,
    templateDescriptor: TemplateDescriptor,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<string> {
    onProgress({
      stage: 'Compiling',
      percentage: 60,
      currentStep: 'Running video processing pipeline',
      totalSteps: 7,
      currentStepIndex: 5,
    });

    // Map the engine's real-time per-segment progress (0..1) into the 60–85%
    // band of the UI, so the bar animates during the render rather than sitting
    // frozen at 60%.
    const outputPath = await compile(projectConfig, templateDescriptor, (fraction) => {
      const clamped = Math.min(Math.max(fraction, 0), 1);
      onProgress({
        stage: 'Compiling',
        percentage: 60 + Math.round(clamped * 25),
        currentStep: renderQuip(clamped),
        totalSteps: 7,
        currentStepIndex: 5,
      });
    });

    if (!outputPath) {
      throw new Error('Core compilation failed - no output produced');
    }

    onProgress({
      stage: 'Compiling',
      percentage: 85,
      currentStep: 'Core compilation completed',
      totalSteps: 7,
      currentStepIndex: 5,
    });

    return outputPath;
  }

  private async finalizeResult(
    outputPath: string,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<CompilationResult> {
    onProgress({
      stage: 'Finalizing',
      percentage: 90,
      currentStep: 'Retrieving processed video',
      totalSteps: 7,
      currentStepIndex: 6,
    });

    const outputData = await this.filesystemAdapter.readFile(outputPath);
    const blob = new Blob([new Uint8Array(outputData)], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    onProgress({
      stage: 'Complete',
      percentage: 100,
      currentStep: 'Video compilation complete!',
      totalSteps: 7,
      currentStepIndex: 7,
    });

    compilationLogger.success('Compilation completed', {
      outputSize: blob.size,
      outputPath,
    });

    return { blob, url, size: blob.size };
  }

  private async cleanupFiles(outputPath: string, userVideoPaths: Record<string, string>): Promise<void> {
    try {
      await Promise.all([
        this.filesystemAdapter.remove(outputPath),
        ...Object.values(userVideoPaths).map((path) => this.filesystemAdapter.remove(path)),
      ]);
    } catch (cleanupError) {
      compilationLogger.warn('Cleanup warning:', cleanupError);
    }
  }

  private convertToTemplateDescriptor(template: Template, formData: Record<string, string>): TemplateDescriptor {
    const templateDescriptor = { ...template.descriptor };

    templateDescriptor.global ??= {};
    templateDescriptor.global.variables ??= {};

    templateDescriptor.global.variables = {
      // Default colors for templates that use them; overridden by any existing
      // variables or form data that follow in the spread.
      color1: 'rgb(255 0 0)',
      color2: 'rgb(250 250 249)',
      ...templateDescriptor.global.variables,
      ...formData,
    };

    compilationLogger.log('Using template descriptor:', {
      templateId: template.id,
      sectionCount: templateDescriptor.sections?.length ?? 0,
      hasMusic: templateDescriptor.global.musicEnabled,
      variables: Object.keys(templateDescriptor.global.variables ?? {}),
    });

    return templateDescriptor;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getStorageInfo() {
    return await this.filesystemAdapter.getStorageUsage();
  }

  async clearStorage() {
    await this.filesystemAdapter.clear();
  }
}

export const coreCompilationService = new CoreCompilationService();
