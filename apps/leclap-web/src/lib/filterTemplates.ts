import type { Template } from '@/services/templateService';

// 'all' = no filter; the rest mirror the shared template orientation union.
export type OrientationFacet = 'all' | Template['orientation'];
export type ComplexityFacet = 'all' | 'simple' | 'intermediate' | 'advanced';

export interface TemplateFacets {
  query: string;
  orientation: OrientationFacet;
  complexity: ComplexityFacet;
}

// Pure filter: facet equality (skipped when 'all') AND a case-insensitive name/description match.
export const filterTemplates = (templates: Template[], facets: TemplateFacets): Template[] => {
  const query = facets.query.trim().toLowerCase();

  return templates.filter((template) => {
    if (facets.orientation !== 'all' && template.orientation !== facets.orientation) return false;

    if (facets.complexity !== 'all' && template.complexity !== facets.complexity) return false;

    if (query.length === 0) return true;

    return `${template.name} ${template.description}`.toLowerCase().includes(query);
  });
};
