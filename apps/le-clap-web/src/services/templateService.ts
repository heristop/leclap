// Re-export from core package for consistency
export type { TemplateDescriptor } from '@ffmpeg-video-composer/core';
import { coreTemplateService, type CoreTemplate } from '@/infrastructure/templates/coreTemplateService';
import { type TemplateDescriptor } from '@ffmpeg-video-composer/core';
import { userTemplateService } from '@/services/userTemplateService';
import { templateLogger } from '@/lib/logger';

export interface Template {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  hasForm: boolean;
  complexity: 'simple' | 'intermediate' | 'advanced';
  // 'sample' = built-in template; 'user' = created by the user (localStorage).
  source: 'sample' | 'user';
  descriptor: TemplateDescriptor;
}

// Server response interface - removed as unused

// Environment configuration
const getServerUrl = () => {
  // In development, use localhost:8082
  // In production, this could be configured via environment variables
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8082';
  }
  // For production, you would set this to your actual server URL
  return 'http://localhost:8082';
};

// Real template definitions - these provide metadata about templates
const TEMPLATE_METADATA: Partial<Record<string, Omit<Template, 'id' | 'descriptor' | 'source'>>> = {
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
  private readonly serverUrl = getServerUrl();
  private readonly templatesCache = new Map<string, TemplateDescriptor>();

  async loadTemplate(templateId: string): Promise<TemplateDescriptor> {
    const cached = this.templatesCache.get(templateId);

    if (cached !== undefined) {
      return cached;
    }

    try {
      templateLogger.log(`Loading template: ${templateId}`);

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

  private convertCoreTemplate(coreTemplate: CoreTemplate): Template {
    const template: Template = {
      id: coreTemplate.id,
      name: coreTemplate.name,
      description: coreTemplate.description,
      orientation: coreTemplate.orientation,
      hasForm: coreTemplate.hasForm,
      complexity: this.mapCoreComplexity(coreTemplate.category),
      source: 'sample',
      descriptor: coreTemplate.templateDescriptor,
    };
    this.templatesCache.set(coreTemplate.id, coreTemplate.templateDescriptor);

    return template;
  }

  private addLegacyTemplate(
    templateId: string,
    metadata: Omit<Template, 'id' | 'descriptor' | 'source'>,
    templates: Template[],
  ): void {
    try {
      const fallbackDescriptor = this.createLegacyDescriptor(templateId, metadata);
      const template: Template = { id: templateId, ...metadata, source: 'sample', descriptor: fallbackDescriptor };
      this.templatesCache.set(templateId, fallbackDescriptor);
      templates.push(template);
    } catch (templateError) {
      templateLogger.warn(`Failed to process legacy template ${templateId}:`, templateError);
    }
  }

  async getAllTemplates(): Promise<Template[]> {
    try {
      templateLogger.log('Loading core templates');

      const coreTemplates = await coreTemplateService.getTemplates();
      const templates: Template[] = coreTemplates.map(ct => this.convertCoreTemplate(ct));

      for (const [templateId, metadata] of Object.entries(TEMPLATE_METADATA)) {
        // Skip ones already present by id OR by display name — the legacy `video`
        // duplicates core `simple-video` ("Simple Video Processing").
        if (metadata === undefined || templates.some(t => t.id === templateId || t.name === metadata.name)) {
          continue;
        }
        this.addLegacyTemplate(templateId, metadata, templates);
      }

      // Append user-created templates (localStorage) so they sit alongside samples.
      templates.push(...userTemplateService.list());

      templateLogger.success(`Loaded ${templates.length} templates`);

      return templates;
    } catch (error) {
      templateLogger.error('Failed to load templates:', error);

      throw new Error(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTemplate(templateId: string): Promise<Template | null> {
    // User-created templates (localStorage) take precedence and carry their own descriptor.
    const userTemplate = userTemplateService.get(templateId);

    if (userTemplate) {
      return userTemplate;
    }

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
          source: 'sample',
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
        source: 'sample',
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

    for (const section of template.sections ?? []) {
      if (section.type === 'form' && section.options?.fields) {
        // Core's Field.label is a Translation (values may be undefined); the
        // consumers here only read field names/length, so coerce the shape.
        formFields.push(...(section.options.fields as unknown as typeof formFields));
      }
    }

    return formFields;
  }

  getTemplateComplexity(template: TemplateDescriptor): 'simple' | 'intermediate' | 'advanced' {
    // Single pass over the sections instead of three separate traversals.
    let formSections = 0;
    let videoSections = 0;
    let totalFilters = 0;

    for (const section of template.sections ?? []) {
      if (section.type === 'form') formSections++;

      if (section.type === 'project_video') videoSections++;

      totalFilters += section.filters?.length ?? 0;
    }

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

  private createLegacyDescriptor(id: string, metadata: Omit<Template, 'id' | 'descriptor' | 'source'>): TemplateDescriptor {
    const descriptor: TemplateDescriptor = {
      global: {
        orientation: metadata.orientation,
        musicEnabled: false,
        transitionDuration: 0.5
      },
      sections: [
        {
          // Name matches the uploaded-file key (video_1) and the project_video
          // type consumes userVideoPaths[name], so the upload reaches the segment.
          name: "video_1",
          type: "project_video",
          options: {
            duration: 5
          }
        }
      ]
    };

    // Add grayscale filter for debug template
    const firstSection = descriptor.sections?.[0];

    if (id === 'debug_grayscale' && firstSection !== undefined) {
      firstSection.filters = [{
        type: 'hue',
        value: 's=0'
      }];
    }

    return descriptor;
  }
}

export const templateService = new TemplateService();
