export type TemplateOrientation = 'landscape' | 'portrait';

export type TemplateVariables = Record<string, string | string[]>;

export interface TemplateGlobal {
  orientation?: string;
  variables?: TemplateVariables;
  musicEnabled?: boolean;
  [key: string]: unknown;
}

export interface TemplateSectionOptions {
  useVideoSection?: string;
  fields?: Array<{ name: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface TemplateRenderableSection {
  name: string;
  type: string;
  options?: TemplateSectionOptions;
  filters?: unknown[];
  [key: string]: unknown;
}

export interface TemplatePartialRefSection {
  type: 'partial';
  name?: string;
  ref?: string;
  prefix?: string;
  variables?: Record<string, string>;
  sections?: TemplateSection[];
  [key: string]: unknown;
}

export type TemplateSection = TemplateRenderableSection | TemplatePartialRefSection;

export interface TemplateDescriptor {
  meta?: TemplateMeta;
  global?: TemplateGlobal;
  sections?: TemplateSection[];
  [key: string]: unknown;
}

export type AppTemplateCategory = 'advanced' | 'portrait';
export type TemplateComplexity = 'simple' | 'intermediate' | 'advanced';

export interface TemplateMeta {
  name?: string;
  description?: string;
}
