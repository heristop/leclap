// Core package template loading service
import { templateLogger } from '@/lib/logger';

type Translation = Record<string, string | undefined>;
type Variables = Record<string, string | string[]>;
type Field = { name: string; maxLength: number; label: Translation };
type FilterValues = {
  h?: number | string;
  w?: number | string;
  x?: number | string;
  y?: number | string;
  c?: string;
  t?: string | number;
  text?: Translation;
  fontcolor?: string;
  fontsize?: number | string;
  fontfile?: string;
  alpha?: string;
  d?: string;
  st?: string;
  color?: string;
  box?: number;
  boxcolor?: string;
  boxborderw?: number;
};
type SectionFilter = { type: string; value?: string | number; values?: FilterValues; range?: string };
type SectionOptions = { duration?: number; fields?: Field[]; forceAspectRatio?: boolean; [key: string]: unknown };
type TemplateSection = {
  name: string;
  type: string;
  options?: SectionOptions;
  filters?: SectionFilter[];
  title?: Translation;
  description?: Translation;
};
type TemplateDescriptorGlobal = {
  variables?: Variables;
  orientation?: string;
  colorsList?: string[];
  musicEnabled?: boolean;
  audioVolumeLevel?: number;
  transitionDuration?: number;
};
interface TemplateDescriptor {
  global?: TemplateDescriptorGlobal;
  sections?: TemplateSection[];
}

export interface CoreTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sample' | 'video' | 'portrait' | 'advanced' | 'demo';
  orientation: 'landscape' | 'portrait';
  hasForm: boolean;
  templateDescriptor: TemplateDescriptor;
  previewImage?: string;
}

// Core package templates with metadata
const CORE_TEMPLATES: Record<string, CoreTemplate | undefined> = {
  'simple-video': {
    id: 'simple-video',
    name: 'Simple Video Processing',
    description: 'Basic video with fade effects and color transitions - uses your uploaded video',
    category: 'video',
    orientation: 'landscape',
    hasForm: false,
    templateDescriptor: {
      global: {
        variables: {
          colorTransition: '#000000',
        },
        orientation: 'landscape',
        musicEnabled: false,
        transitionDuration: 0.5,
      },
      sections: [
        {
          name: 'video_1',
          type: 'project_video',
          options: {
            duration: 2000,
            forceAspectRatio: true,
          },
          filters: [
            {
              type: 'fade',
              values: {
                t: 'in',
                st: '0',
                d: '0.5',
                color: '{{ colorTransition }}',
              },
            },
            {
              type: 'fade',
              values: {
                t: 'out',
                st: '1.5',
                d: '0.5',
                color: '{{ colorTransition }}',
              },
            },
          ],
        },
      ],
    },
  },

  'sample-advanced': {
    id: 'sample-advanced',
    name: 'Professional Video with Text',
    description: 'Advanced template with forms and text overlay effects - uses your uploaded video',
    category: 'advanced',
    orientation: 'landscape',
    hasForm: true,
    templateDescriptor: {
      global: {
        variables: {
          colorsList: ['rgb(41 37 36)', 'rgb(250 250 249)'],
        },
        orientation: 'landscape',
        musicEnabled: false,
        transitionDuration: 0.5,
      },
      sections: [
        {
          name: 'form_1',
          type: 'form',
          title: {
            en: 'Personal Information',
          },
          description: {
            en: 'Please provide your details',
          },
          options: {
            fields: [
              {
                name: 'form_1_firstname',
                maxLength: 30,
                label: {
                  en: 'First Name',
                },
              },
              {
                name: 'form_1_lastname',
                maxLength: 30,
                label: {
                  en: 'Last Name',
                },
              },
              {
                name: 'form_1_job',
                maxLength: 40,
                label: {
                  en: 'Your Job',
                },
              },
            ],
          },
        },
        {
          name: 'video_1',
          type: 'project_video',
          title: {
            en: 'Upload your video',
          },
          description: {
            en: 'Your video with text overlay',
          },
          options: {
            duration: 20000,
            forceAspectRatio: true,
          },
          filters: [
            {
              type: 'drawtext',
              values: {
                text: {
                  en: '{{ form_1_firstname }} {{ form_1_lastname }}',
                },
                fontfile: 'Rubik.ttf',
                fontcolor: 'white',
                fontsize: 40,
                x: '(w-text_w)/2',
                y: '(h-text_h)/1.2',
                box: 1,
                boxcolor: 'black@0.5',
                boxborderw: 5,
              },
            },
            {
              type: 'drawtext',
              values: {
                text: {
                  en: '{{ form_1_job }}',
                },
                fontfile: 'Rubik.ttf',
                fontcolor: 'white',
                fontsize: 25,
                x: '(w-text_w)/2',
                y: '(h-text_h)/1.1',
                box: 1,
                boxcolor: 'black@0.5',
                boxborderw: 5,
              },
            },
          ],
        },
      ],
    },
  },

  'concat-with-music': {
    id: 'concat-with-music',
    name: 'Simple Video with Effects',
    description: 'Basic video processing with scaling and fade effects - uses your uploaded video',
    category: 'video',
    orientation: 'landscape',
    hasForm: false,
    templateDescriptor: {
      global: {
        variables: {},
        orientation: 'landscape',
        musicEnabled: false,
        transitionDuration: 1,
      },
      sections: [
        {
          name: 'video_1',
          type: 'project_video',
          options: {
            duration: 5000,
            forceAspectRatio: true,
          },
          filters: [
            {
              type: 'scale',
              value: '1280:720',
            },
            {
              type: 'fade',
              values: {
                t: 'in',
                st: '0',
                d: '1',
              },
            },
            {
              type: 'fade',
              values: {
                t: 'out',
                st: '4',
                d: '1',
              },
            },
          ],
        },
      ],
    },
  },
};

class CoreTemplateService {
  async getTemplates(): Promise<CoreTemplate[]> {
    try {
      templateLogger.log('Loading core templates');

      return Object.values(CORE_TEMPLATES).filter((t): t is CoreTemplate => t !== undefined);
    } catch (error) {
      templateLogger.error('Failed to load templates:', error);

      throw new Error(`Failed to load core templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTemplate(id: string): Promise<CoreTemplate | null> {
    const template = CORE_TEMPLATES[id];

    if (!template) {
      templateLogger.warn(`Template not found: ${id}`);

      return null;
    }

    templateLogger.log(`Loading template: ${template.name}`);

    return template;
  }

  async getTemplatesByCategory(category: CoreTemplate['category']): Promise<CoreTemplate[]> {
    const templates = Object.values(CORE_TEMPLATES).filter(
      (template): template is CoreTemplate => template?.category === category
    );
    templateLogger.log(`Found ${templates.length} templates in category: ${category}`);

    return templates;
  }

  getAvailableCategories(): CoreTemplate['category'][] {
    return ['sample', 'video', 'portrait', 'advanced', 'demo'];
  }

  // Stub for loading templates from the core package's JSON files.
  async loadTemplateFromFile(templatePath: string): Promise<TemplateDescriptor> {
    try {
      templateLogger.log(`Would load template from: ${templatePath}`);

      throw new Error('File-based template loading not yet implemented');
    } catch (error) {
      throw new Error(`Failed to load template from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const coreTemplateService = new CoreTemplateService();
export default CoreTemplateService;
