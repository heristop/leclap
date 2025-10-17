import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { type Template } from './templateService';

export interface CompilationConfig {
  template: Template;
  formData: Record<string, string>;
  files: File[];
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

class SimpleBrowserCompilationService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  private async loadFFmpeg(): Promise<void> {
    if (this.isLoaded) return;

    this.ffmpeg = new FFmpeg();

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    this.isLoaded = true;
  }

  async compileVideo(
    config: CompilationConfig,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<CompilationResult> {
    const { template, formData, files } = config;

    try {
      // Stage 1: Initialize FFmpeg
      onProgress({
        stage: 'Initializing',
        percentage: 10,
        currentStep: 'Loading FFmpeg WebAssembly',
        totalSteps: 5,
        currentStepIndex: 1,
      });

      await this.loadFFmpeg();
      if (!this.ffmpeg) throw new Error('FFmpeg failed to load');

      // Stage 2: Prepare Files
      onProgress({
        stage: 'Preparing',
        percentage: 25,
        currentStep: 'Loading video files',
        totalSteps: 5,
        currentStepIndex: 2,
      });

      // Write input files to FFmpeg FS
      const inputFiles: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `input${i}.${file.name.split('.').pop()}`;
        await this.ffmpeg.writeFile(fileName, await fetchFile(file));
        inputFiles.push(fileName);

        onProgress({
          stage: 'Preparing',
          percentage: 25 + ((i + 1) * 15) / files.length,
          currentStep: `Loaded ${file.name}`,
          totalSteps: 5,
          currentStepIndex: 2,
        });
      }

      // Stage 3: Process Template
      onProgress({
        stage: 'Processing',
        percentage: 50,
        currentStep: 'Applying template effects',
        totalSteps: 5,
        currentStepIndex: 3,
      });

      // Simple concatenation with fade effects for demo
      const outputFile = 'output.mp4';

      if (inputFiles.length === 1) {
        // Single video - just copy with potential scale
        await this.ffmpeg.exec([
          '-i',
          inputFiles[0],
          '-vf',
          'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '23',
          '-c:a',
          'aac',
          outputFile,
        ]);
      } else {
        // Multiple videos - concatenate with cross-fade
        let filterComplex = '';
        let inputs = '';

        for (let i = 0; i < inputFiles.length; i++) {
          inputs += `-i ${inputFiles[i]} `;
          if (i > 0) {
            filterComplex += `[${i - 1}:v][${i}:v]xfade=transition=fade:duration=1:offset=3[v${i}]; `;
          }
        }

        if (inputFiles.length > 2) {
          // Chain multiple fades
          filterComplex = filterComplex.replace(/\[v\d+\]/g, (match, offset) => {
            const num = parseInt(match.match(/\d+/)?.[0] || '0');
            return num === inputFiles.length - 1 ? '[outv]' : match;
          });
        } else {
          filterComplex = filterComplex.replace('[v1]', '[outv]');
        }

        await this.ffmpeg.exec([
          ...inputs.trim().split(' '),
          '-filter_complex',
          filterComplex,
          '-map',
          '[outv]',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '23',
          outputFile,
        ]);
      }

      onProgress({
        stage: 'Processing',
        percentage: 80,
        currentStep: 'Video compilation completed',
        totalSteps: 5,
        currentStepIndex: 4,
      });

      // Stage 4: Prepare Output
      onProgress({
        stage: 'Finalizing',
        percentage: 90,
        currentStep: 'Preparing output file',
        totalSteps: 5,
        currentStepIndex: 5,
      });

      const data = await this.ffmpeg.readFile(outputFile);
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      onProgress({
        stage: 'Complete',
        percentage: 100,
        currentStep: 'Video compilation complete!',
        totalSteps: 5,
        currentStepIndex: 5,
      });

      // Cleanup
      await this.ffmpeg.deleteFile(outputFile);
      for (const file of inputFiles) {
        await this.ffmpeg.deleteFile(file);
      }

      return {
        blob,
        url,
        size: blob.size,
      };
    } catch (error) {
      console.error('Video compilation error:', error);
      throw new Error(`Video compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const simpleBrowserCompilationService = new SimpleBrowserCompilationService();
