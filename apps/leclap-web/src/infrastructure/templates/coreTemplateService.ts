// Core package template loading service
import { templateLogger } from '@/lib/logger';
// Premium templates are authored once in the core package's shared app-template list; web + expo +
// the MCP catalog all consume the same source. The remaining demos below are web-only.
import { APP_TEMPLATES } from 'ffmpeg-video-composer/src/shared/templates';
import simpleVideo from './core/simple-video.json';
import sampleAdvanced from './core/sample-advanced.json';
import concatWithMusic from './core/concat-with-music.json';

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

// Premium templates come from the shared app-template list; map each into the web CoreTemplate shape.
const PREMIUM_TEMPLATES: CoreTemplate[] = APP_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
  orientation: t.orientation,
  hasForm: t.hasForm,
  templateDescriptor: t.descriptor as unknown as TemplateDescriptor,
}));

// The premium set (shared) plus the web-only demos that still live as local JSON under ./core/.
const TEMPLATE_SOURCES = [
  ...PREMIUM_TEMPLATES,
  simpleVideo,
  sampleAdvanced,
  concatWithMusic,
] as unknown as CoreTemplate[];

const CORE_TEMPLATES: Record<string, CoreTemplate | undefined> = Object.fromEntries(
  TEMPLATE_SOURCES.map((template) => [template.id, template])
);

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
