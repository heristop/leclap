// Handwritten one-line descriptions for each built-in template, keyed by id (filename sans
// `.json`). Used by the catalog to give agents a human-readable summary of what each starting
// point produces. The catalog ships only the curated premium app templates; ids missing here
// fall back to a generic string in `index.ts` (never crash).
export const templateMetadata: Record<string, string> = {
  'premium-fast-curious':
    'Punchy two-tone flash intro: name on bold alternating cards, a quick this-or-that, then a graded clip',
  'premium-intro':
    'Cinematic landscape title card: bold gold name, accent rule and subtitle on a letterboxed navy grade',
  'premium-quote': 'Editorial landscape quote card: serif quotation on warm paper with gold accents and attribution',
  'premium-quote-portrait':
    'Vertical story quote card: gold script headline over a layered purple grade with serif body',
  'premium-reel-portrait':
    'Vertical social reel cover: bold headline, red accent shapes, subtitle and handle on a dark grade',
  'premium-spotlight':
    'Wraps a user clip (project_video) in a cinematic intro + outro: graded with a vignette and a gold lower-third caption from the name field',
  'premium-titles':
    'Three-card landscape title sequence with fade transitions in a cohesive teal-and-charcoal brand grade',
};
