export interface TemplateDescriptor {
  global: {
    variables?: Record<string, any>;
    music?: {
      name: string;
      url?: string;
    };
    orientation: 'landscape' | 'portrait';
    musicEnabled: boolean;
    audioVolumeLevel?: number;
    transitionDuration: number;
  };
  sections: Array<{
    name: string;
    type: 'video' | 'form' | 'project_video' | 'color_background' | 'music';
    title?: Record<string, string>;
    description?: Record<string, string>;
    options?: Record<string, any>;
    inputs?: Array<any>;
    maps?: Array<any>;
    filters?: Array<any>;
  }>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  hasForm: boolean;
  complexity: 'simple' | 'intermediate' | 'advanced';
  descriptor: TemplateDescriptor;
}

// Server response interface
interface ServerTemplate {
  name: string; // filename like "sample.json"
  content: TemplateDescriptor;
}

// Environment configuration
const getServerUrl = () => {
  // In development, use localhost:3000
  // In production, this could be configured via environment variables
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  // For production, you would set this to your actual server URL
  return 'http://localhost:3000';
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
};

class TemplateService {
  private templatesCache = new Map<string, TemplateDescriptor>();
  private serverUrl = getServerUrl();

  async loadTemplate(templateId: string): Promise<TemplateDescriptor> {
    if (this.templatesCache.has(templateId)) {
      return this.templatesCache.get(templateId)!;
    }

    try {
      // Fetch all templates from server and find the one we need
      const response = await fetch(`${this.serverUrl}/templates`);

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const serverTemplates: ServerTemplate[] = await response.json();

      // Find the template by matching the filename
      const targetFileName = `${templateId}.json`;
      const serverTemplate = serverTemplates.find((t) => t.name === targetFileName);

      if (!serverTemplate) {
        throw new Error(`Template ${templateId} not found on server`);
      }

      const descriptor = serverTemplate.content;
      this.templatesCache.set(templateId, descriptor);
      return descriptor;
    } catch (error) {
      console.error(`Failed to load template ${templateId}:`, error);
      throw new Error(`Template ${templateId} not found: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllTemplates(): Promise<Template[]> {
    try {
      // Fetch all templates from server in one request
      const response = await fetch(`${this.serverUrl}/templates`);

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const serverTemplates: ServerTemplate[] = await response.json();
      const templates: Template[] = [];

      for (const serverTemplate of serverTemplates) {
        try {
          // Extract template ID from filename (remove .json extension)
          const templateId = serverTemplate.name.replace('.json', '');

          // Get metadata for this template
          const metadata = TEMPLATE_METADATA[templateId];

          if (!metadata) {
            console.warn(`No metadata found for template ${templateId}, skipping`);
            continue;
          }

          // Cache the descriptor
          this.templatesCache.set(templateId, serverTemplate.content);

          // Create template object with metadata and descriptor
          const template: Template = {
            id: templateId,
            ...metadata,
            // Override complexity and hasForm based on actual content
            complexity: this.getTemplateComplexity(serverTemplate.content),
            hasForm: this.extractFormFields(serverTemplate.content).length > 0,
            descriptor: serverTemplate.content,
          };

          templates.push(template);
        } catch (templateError) {
          console.warn(`Failed to process template ${serverTemplate.name}:`, templateError);
        }
      }

      if (templates.length === 0) {
        throw new Error('No valid templates found on server');
      }

      return templates;
    } catch (error) {
      console.error('Failed to load templates from server:', error);
      throw new Error(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTemplate(templateId: string): Promise<Template | null> {
    try {
      const descriptor = await this.loadTemplate(templateId);
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
      console.error(`Failed to get template ${templateId}:`, error);
      return null;
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
      console.error('Server connection test failed:', error);
      return false;
    }
  }

  getServerUrl(): string {
    return this.serverUrl;
  }
}

export const templateService = new TemplateService();
