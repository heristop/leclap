// Re-export from core package for consistency
export type { TemplateDescriptor } from '@ffmpeg-video-composer/core';
// Import the sophisticated core template service
import { coreTemplateService, type CoreTemplate } from './coreTemplateService';
import { type TemplateDescriptor } from '@ffmpeg-video-composer/core';
import { templateLogger } from '../lib/logger';

export interface Template {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  hasForm: boolean;
  complexity: 'simple' | 'intermediate' | 'advanced';
  descriptor: TemplateDescriptor;
}

// Server response interface - removed as unused

// Environment configuration
const getServerUrl = () => {
  // In development, use localhost:8082
  // In production, this could be configured via environment variables
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8082';
  }
  // For production, you would set this to your actual server URL
  return 'http://localhost:8082';
};

// Real template definitions - these provide metadata about templates
const TEMPLATE_METADATA: Record<string, Omit<Template, 'id' | 'descriptor'>> = {
  sample: {
    name: 'Interactive Profile Video',
    description:
      'Create a professional profile video with custom forms, animated overlays, and dynamic text. Perfect for personal branding.',
    orientation: 'landscape',
    hasForm: true,
    complexity: 'advanced',
  },
  concat_videos_with_music: {
    name: 'Video Concatenation with Music',
    description:
      'Join multiple videos with smooth transitions and background music. Great for creating compilation videos.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'simple',
  },
  video: {
    name: 'Simple Video Processing',
    description:
      'Basic video processing with fade effects and color transitions. Perfect for quick video enhancements.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'simple',
  },
  portrait: {
    name: 'Portrait Video Format',
    description: 'Optimize videos for mobile viewing with portrait orientation and custom overlays.',
    orientation: 'portrait',
    hasForm: false,
    complexity: 'intermediate',
  },
  video_speed: {
    name: 'Speed Control Template',
    description: 'Create dynamic videos with variable playback speeds and smooth transitions.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'intermediate',
  },
  picture: {
    name: 'Picture to Video',
    description: 'Convert static images into engaging videos with animations and effects.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'simple',
  },
  intertitle: {
    name: 'Title Card Template',
    description: 'Create engaging title cards and transitions for your video content.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'intermediate',
  },
  local_music: {
    name: 'Local Music Integration',
    description: 'Add custom background music and audio mixing to your videos.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'intermediate',
  },
  fast_and_curious: {
    name: 'Fast & Curious Style',
    description: 'High-energy video processing with dynamic effects and rapid transitions.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'advanced',
  },
  loop_music: {
    name: 'Looping Music Template',
    description: 'Create seamless video loops with synchronized background music.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'intermediate',
  },
  debug_grayscale: {
    name: 'Debug / Grayscale',
    description: 'Applies a simple grayscale filter to test the video processing pipeline.',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'simple',
  },
};

class TemplateService {
  private serverUrl = getServerUrl();
  private templatesCache = new Map<string, TemplateDescriptor>();

  async loadTemplate(templateId: string): Promise<TemplateDescriptor> {
    if (this.templatesCache.has(templateId)) {
      return this.templatesCache.get(templateId)!;
    }

    try {
      templateLogger.log(`Loading template: ${templateId}`);

      // Use core template service for sophisticated templates
      const coreTemplate = await coreTemplateService.getTemplate(templateId);

      if (coreTemplate) {
        const descriptor = coreTemplate.templateDescriptor;
        this.templatesCache.set(templateId, descriptor);
        return descriptor;
      }

      // Fallback to legacy metadata-based templates if core template not found
      const metadata = TEMPLATE_METADATA[templateId];
      if (!metadata) {
        throw new Error(`Template ${templateId} not found in core or legacy templates`);
      }

      // Create a simple template descriptor for legacy templates
      const fallbackDescriptor = this.createLegacyDescriptor(templateId, metadata);

      this.templatesCache.set(templateId, fallbackDescriptor);
      return fallbackDescriptor;
    } catch (error) {
      templateLogger.error(`Failed to load template ${templateId}:`, error);
      throw new Error(`Template ${templateId} not found: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllTemplates(): Promise<Template[]> {
    try {
      templateLogger.log('Loading core templates');

      // Get all sophisticated core templates
      const coreTemplates = await coreTemplateService.getTemplates();
      const templates: Template[] = [];

      // Convert core templates to Template interface
      for (const coreTemplate of coreTemplates) {
        const template: Template = {
          id: coreTemplate.id,
          name: coreTemplate.name,
          description: coreTemplate.description,
          orientation: coreTemplate.orientation,
          hasForm: coreTemplate.hasForm,
          complexity: this.mapCoreComplexity(coreTemplate.category),
          descriptor: coreTemplate.templateDescriptor,
        };

        // Cache the descriptor
        this.templatesCache.set(coreTemplate.id, coreTemplate.templateDescriptor);
        templates.push(template);
      }

      // Add legacy templates that aren't in core
      for (const [templateId, metadata] of Object.entries(TEMPLATE_METADATA)) {
        // Skip if already loaded from core
        if (templates.some(t => t.id === templateId)) {
          continue;
        }

        try {
          const fallbackDescriptor = this.createLegacyDescriptor(templateId, metadata);

          const template: Template = {
            id: templateId,
            ...metadata,
            descriptor: fallbackDescriptor,
          };

          this.templatesCache.set(templateId, fallbackDescriptor);
          templates.push(template);
        } catch (templateError) {
          templateLogger.warn(`Failed to process legacy template ${templateId}:`, templateError);
        }
      }

      templateLogger.success(`Loaded ${templates.length} templates`);
      return templates;
    } catch (error) {
      templateLogger.error('Failed to load templates:', error);
      throw new Error(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTemplate(templateId: string): Promise<Template | null> {
    try {
      const descriptor = await this.loadTemplate(templateId);

      // Try to get from core templates first
      const coreTemplate = await coreTemplateService.getTemplate(templateId);
      if (coreTemplate) {
        return {
          id: coreTemplate.id,
          name: coreTemplate.name,
          description: coreTemplate.description,
          orientation: coreTemplate.orientation,
          hasForm: coreTemplate.hasForm,
          complexity: this.mapCoreComplexity(coreTemplate.category),
          descriptor: coreTemplate.templateDescriptor,
        };
      }

      // Fallback to legacy metadata
      const metadata = TEMPLATE_METADATA[templateId];
      if (!metadata) {
        return null;
      }

      return {
        id: templateId,
        ...metadata,
        complexity: this.getTemplateComplexity(descriptor),
        hasForm: this.extractFormFields(descriptor).length > 0,
        descriptor,
      };
    } catch (error) {
      templateLogger.error(`Failed to get template ${templateId}:`, error);
      return null;
    }
  }

  private mapCoreComplexity(category: CoreTemplate['category']): 'simple' | 'intermediate' | 'advanced' {
    switch (category) {
      case 'advanced':
        return 'advanced';
      case 'sample':
      case 'demo':
        return 'intermediate';
      case 'video':
      case 'portrait':
      default:
        return 'simple';
    }
  }

  extractFormFields(template: TemplateDescriptor): Array<{
    name: string;
    label: Record<string, string>;
    maxLength?: number;
    type?: string;
  }> {
    const formFields: Array<{
      name: string;
      label: Record<string, string>;
      maxLength?: number;
      type?: string;
    }> = [];

    for (const section of template.sections) {
      if (section.type === 'form' && section.options?.fields) {
        formFields.push(...section.options.fields);
      }
    }

    return formFields;
  }

  getTemplateComplexity(template: TemplateDescriptor): 'simple' | 'intermediate' | 'advanced' {
    const formSections = template.sections.filter((s) => s.type === 'form').length;
    const videoSections = template.sections.filter((s) => s.type === 'project_video').length;
    const totalFilters = template.sections.reduce((acc, section) => acc + (section.filters?.length || 0), 0);

    if (formSections > 2 || totalFilters > 15) return 'advanced';
    if (formSections > 0 || videoSections > 1 || totalFilters > 5) return 'intermediate';
    return 'simple';
  }

  // Test server connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      return response.ok;
    } catch (error) {
      templateLogger.error('Server connection test failed:', error);
      return false;
    }
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  private createLegacyDescriptor(id: string, metadata: Omit<Template, 'id' | 'descriptor'>): TemplateDescriptor {
    const descriptor: TemplateDescriptor = {
      global: {
        orientation: metadata.orientation,
        musicEnabled: false,
        transitionDuration: 0.5
      },
      sections: [
        {
          name: "main",
          type: "video",
          options: {
            duration: 5
          }
        }
      ]
    };

    // Add grayscale filter for debug template
    if (id === 'debug_grayscale') {
      descriptor.sections![0].filters = [{
        type: 'hue',
        value: 's=0'
      }];
    }

    return descriptor;
  }
}

export const templateService = new TemplateService();
