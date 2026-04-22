// Core-powered compilation service for sophisticated video processing
import 'reflect-metadata';
import { compile } from '@ffmpeg-video-composer/core/browser';
import BrowserFilesystemAdapter from '@ffmpeg-video-composer/core/src/platform/filesystem/BrowserFilesystemAdapter';
import type { ProjectConfig, TemplateDescriptor } from '@ffmpeg-video-composer/core/src/core/types';
import { type Template } from './templateService';
import { compilationLogger } from '../lib/logger';

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

class CoreCompilationService {
  private filesystemAdapter = new BrowserFilesystemAdapter();

  async compileVideo(
    config: CompilationConfig,
    onProgress: (progress: CompilationProgress) => void
  ): Promise<CompilationResult> {
    const { template, formData, files } = config;

    try {
      // Stage 1: Initialize
      onProgress({
        stage: 'Initializing',
        percentage: 5,
        currentStep: 'Setting up core compilation environment',
        totalSteps: 7,
        currentStepIndex: 1,
      });

      // Stage 2: Prepare Files
      onProgress({
        stage: 'Preparing',
        percentage: 15,
        currentStep: 'Loading video files into browser storage',
        totalSteps: 7,
        currentStepIndex: 2,
      });

      // Clear previous files
      await this.filesystemAdapter.clear();

      // Store uploaded files with proper naming
      const userVideoPaths: Record<string, string> = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `video_${i + 1}.${file.name.split('.').pop()}`;
        const storagePath = `/tmp/${fileName}`;

        await this.filesystemAdapter.storeFile(file, storagePath);
        userVideoPaths[`video_${i + 1}`] = storagePath;

        onProgress({
          stage: 'Preparing',
          percentage: 15 + ((i + 1) * 20) / files.length,
          currentStep: `Loaded ${file.name} (${this.formatFileSize(file.size)})`,
          totalSteps: 7,
          currentStepIndex: 2,
        });
      }



      // Stage 3: Setup Project Config
      onProgress({
        stage: 'Configuring',
        percentage: 40,
        currentStep: 'Setting up project configuration',
        totalSteps: 7,
        currentStepIndex: 3,
      });

      const buildDir = '/tmp/build';
      await this.filesystemAdapter.ensureDir(buildDir);

      const projectConfig: ProjectConfig = {
        buildDir,
        userVideoPaths,
        fields: formData,
      };

      // Stage 4: Process Template
      onProgress({
        stage: 'Processing',
        percentage: 50,
        currentStep: 'Parsing template and applying effects',
        totalSteps: 7,
        currentStepIndex: 4,
      });

      // Convert our template format to core TemplateDescriptor
      const templateDescriptor: TemplateDescriptor = this.convertToTemplateDescriptor(template, formData);

      compilationLogger.log('Starting core compilation with:', {
        userVideoPaths: Object.keys(userVideoPaths),
        templateId: template.id,
        formData,
        templateDescriptor
      });

      // Stage 5: Core Compilation
      onProgress({
        stage: 'Compiling',
        percentage: 60,
        currentStep: 'Running sophisticated video processing pipeline',
        totalSteps: 7,
        currentStepIndex: 5,
      });

      // Use the core compile function
      const outputPath = await compile(projectConfig, templateDescriptor);

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

      // Stage 6: Retrieve Result
      onProgress({
        stage: 'Finalizing',
        percentage: 90,
        currentStep: 'Retrieving processed video',
        totalSteps: 7,
        currentStepIndex: 6,
      });

      const outputData = await this.filesystemAdapter.readFile(outputPath);
      const blob = new Blob([outputData], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      // Stage 7: Complete
      onProgress({
        stage: 'Complete',
        percentage: 100,
        currentStep: 'Professional video compilation complete!',
        totalSteps: 7,
        currentStepIndex: 7,
      });

      compilationLogger.success('Compilation completed', {
        outputSize: blob.size,
        outputPath
      });

      // Cleanup
      try {
        await this.filesystemAdapter.remove(outputPath);
        for (const path of Object.values(userVideoPaths)) {
          await this.filesystemAdapter.remove(path);
        }
      } catch (cleanupError) {
        compilationLogger.warn('Cleanup warning:', cleanupError);
      }

      return {
        blob,
        url,
        size: blob.size,
      };
    } catch (error) {
      compilationLogger.error('Compilation error:', error);
      throw new Error(`Professional video compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private convertToTemplateDescriptor(template: Template, formData: Record<string, string>): TemplateDescriptor {
    // Use the sophisticated template descriptor directly from the template
    const templateDescriptor = { ...template.descriptor };

    // Merge form data into global variables
    if (!templateDescriptor.global.variables) {
      templateDescriptor.global.variables = {};
    }

    // Add form data to template variables
    templateDescriptor.global.variables = {
      ...templateDescriptor.global.variables,
      ...formData
    };

    // Add default color variables for templates that use them
    if (!templateDescriptor.global.variables.color1) {
      templateDescriptor.global.variables.color1 = 'rgb(255 0 0)';
    }
    if (!templateDescriptor.global.variables.color2) {
      templateDescriptor.global.variables.color2 = 'rgb(250 250 249)';
    }

    compilationLogger.log('Using template descriptor:', {
      templateId: template.id,
      sectionCount: templateDescriptor.sections.length,
      hasMusic: templateDescriptor.global.musicEnabled,
      variables: Object.keys(templateDescriptor.global.variables || {})
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