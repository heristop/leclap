// Browser/WASM compilation service backed by the core package.
import 'reflect-metadata';
import { compileBrowser as compile } from '@ffmpeg-video-composer/core/src/browser.ts';
import BrowserFilesystemAdapter from '@ffmpeg-video-composer/core/src/platform/filesystem/BrowserFilesystemAdapter.ts';
import type { ProjectConfig, TemplateDescriptor } from '@ffmpeg-video-composer/core/src/core/types.d.ts';
import { type Template } from '@/services/templateService';
import { compilationLogger } from '@/lib/logger';
import { applyVideoEdits, type VideoEdit } from '@/domain/valueObjects/videoEdits';

export interface CompilationConfig {
  template: Template;
  formData: Record<string, string>;
  files: File[];
  // Per-clip trim/crop selected on the Edit step, keyed by file index. Applied client-side
  // (ffmpeg.wasm) before compilation.
  videoEdits?: Record<number, VideoEdit | undefined>;
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
    const { template, formData, files, videoEdits } = config;

    try {
      onProgress({
        stage: 'Initializing',
        percentage: 5,
        currentStep: 'Initializing',
        totalSteps: 7,
        currentStepIndex: 1,
      });

      await this.filesystemAdapter.clear();

      const editedFiles = await this.applyEdits(files, videoEdits, onProgress);

      const userVideoPaths = await this.storeUploadedFiles(editedFiles, onProgress);

      const projectConfig = await this.setupProjectConfig(userVideoPaths, formData, onProgress);

      // Pre-load bundled TTF fonts so drawtext works in WASM: the WASM
      // ffmpeg-core's freetype cannot decode the woff2 that Google Fonts serves
      // ("Could not load font: unimplemented feature"). With the TTF already in
      // place, fetchFonts() finds it cached and skips the (unusable) woff2 fetch.
      await this.preloadBundledFonts();

      const templateDescriptor = this.prepareTemplateDescriptor(template, formData, userVideoPaths, onProgress);

      const outputPath = await this.runCompilation(projectConfig, templateDescriptor, onProgress);

      const result = await this.finalizeResult(outputPath, onProgress);

      await this.cleanupFiles(outputPath, userVideoPaths);

      return result;
    } catch (error) {
      compilationLogger.error('Compilation error:', error);

      throw new Error(`Video compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Bundled TTF fonts (served from /public/fonts) loaded into the build dir so
  // WASM drawtext can use them instead of the unsupported Google-Fonts woff2.
  private async preloadBundledFonts(): Promise<void> {
    const fonts = ['Rubik.ttf'];
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

  private async applyEdits(
    files: File[],
    videoEdits: Record<number, VideoEdit | undefined> | undefined,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<File[]> {
    if (!videoEdits) {
      return files;
    }

    return applyVideoEdits(files, videoEdits, ({ index, total }) => {
      onProgress({
        stage: 'Editing',
        percentage: 8,
        currentStep: `Applying trim/crop to clip ${index + 1} of ${total}`,
        totalSteps: 7,
        currentStepIndex: 1,
      });
    });
  }

  private async storeUploadedFiles(
    files: File[],
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
      const fileName = `video_${i + 1}.${file.name.split('.').pop() ?? 'mp4'}`;
      const storagePath = `/tmp/${fileName}`;

      return { file, key: `video_${i + 1}`, storagePath };
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
    onProgress: (progress: CompilationProgress) => void
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

    return { buildDir, userVideoPaths, fields: formData };
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
        currentStep: `Rendering video segments… ${Math.round(clamped * 100)}%`,
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
