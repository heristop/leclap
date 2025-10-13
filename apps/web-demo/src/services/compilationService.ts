import { type Template } from './templateService';

// Browser-compatible compilation service
// Since the core package is designed for Node.js, we'll create a browser-compatible version
// that uses WebAssembly FFmpeg instead of the Node.js compile function

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

class CompilationService {
  private ffmpeg: any = null;

  setFFmpeg(ffmpeg: any) {
    this.ffmpeg = ffmpeg;
  }

  async compileVideo(
    config: CompilationConfig,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<CompilationResult> {
    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized');
    }

    const { template, formData, files } = config;

    try {
      // Stage 1: Preparation
      onProgress({
        stage: 'Preparing',
        percentage: 10,
        currentStep: 'Analyzing template and preparing files',
        totalSteps: 6,
        currentStepIndex: 1,
      });

      // Load files into FFmpeg virtual file system
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `input_${i}.${file.name.split('.').pop()}`;
        const fileData = new Uint8Array(await file.arrayBuffer());
        await this.ffmpeg.writeFile(fileName, fileData);

        onProgress({
          stage: 'Preparing',
          percentage: 10 + (i + 1) * 10,
          currentStep: `Loaded ${file.name}`,
          totalSteps: 6,
          currentStepIndex: i + 2,
        });
      }

      // Stage 2: Process Template Configuration
      onProgress({
        stage: 'Processing Template',
        percentage: 30,
        currentStep: 'Applying template configuration',
        totalSteps: 4,
        currentStepIndex: 1,
      });

      // Generate FFmpeg command based on template
      const ffmpegCommand = this.generateFFmpegCommand(template, formData, files);

      onProgress({
        stage: 'Processing Template',
        percentage: 50,
        currentStep: 'Executing video processing',
        totalSteps: 4,
        currentStepIndex: 2,
      });

      // Execute FFmpeg command
      await this.ffmpeg.exec(ffmpegCommand);

      onProgress({
        stage: 'Finalizing',
        percentage: 80,
        currentStep: 'Reading processed video',
        totalSteps: 4,
        currentStepIndex: 3,
      });

      // Read the output file
      const outputFileName = 'output.mp4';
      const outputData = await this.ffmpeg.readFile(outputFileName);
      const blob = new Blob([outputData as any], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      onProgress({
        stage: 'Complete',
        percentage: 100,
        currentStep: 'Video processing complete!',
        totalSteps: 4,
        currentStepIndex: 4,
      });

      // Clean up FFmpeg files
      try {
        await this.ffmpeg.deleteFile(outputFileName);
        for (let i = 0; i < files.length; i++) {
          await this.ffmpeg.deleteFile(`input_${i}.${files[i].name.split('.').pop()}`);
        }
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError);
      }

      return {
        blob,
        url,
        size: blob.size,
      };
    } catch (error) {
      console.error('Compilation error:', error);
      throw new Error(`Video compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateFFmpegCommand(template: Template, formData: Record<string, string>, files: File[]): string[] {
    // For now, create a simplified command based on template characteristics
    // This is a basic implementation - a full implementation would parse the template's
    // sections, filters, and maps to generate the appropriate FFmpeg command

    const outputFileName = 'output.mp4';
    const orientation = template.orientation;
    // Note: Music handling will be implemented in future versions

    if (files.length === 1) {
      // Single video processing
      const inputFile = `input_0.${files[0].name.split('.').pop()}`;

      const command = [
        '-i',
        inputFile,
        '-vf',
        this.generateVideoFilters(template, formData, orientation),
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputFileName,
      ];

      return command;
    } else {
      // Multiple videos - concatenation
      // For simplicity, we'll handle concatenation in the main function
      // Future versions will implement more sophisticated concat handling

      return [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        'concat_list.txt',
        '-vf',
        this.generateVideoFilters(template, formData, orientation),
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputFileName,
      ];
    }
  }

  private generateVideoFilters(
    _template: Template,
    formData: Record<string, string>,
    orientation: 'landscape' | 'portrait'
  ): string {
    // Basic video filters based on template
    const baseSize = orientation === 'portrait' ? '720:1280' : '1920:1080';
    const filters = [`scale=${baseSize}:force_original_aspect_ratio=decrease`, `pad=${baseSize}:(ow-iw)/2:(oh-ih)/2`];

    // Note: Text overlays disabled in browser FFmpeg due to font limitations
    // In a full implementation, text would be rendered server-side or using CSS overlays

    return filters.join(',');
  }
}

export const compilationService = new CompilationService();
