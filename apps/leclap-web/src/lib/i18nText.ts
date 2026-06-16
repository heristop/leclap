// Locale-aware helpers for the author-supplied title/description strings carried by template
// sections as per-locale Translation maps ({ en: '…', fr: '…' }). Display sites must resolve to the
// viewer's current language instead of hard-coding English.

// Pick the string for `locale`, falling back to English, then to the first non-empty translation
// present. Single-locale templates (the common case) are unaffected.
export function resolveTranslation(
  translation: Record<string, string | undefined> | undefined,
  locale: string
): string | undefined {
  if (!translation) {
    return undefined;
  }

  return translation[locale] ?? translation.en ?? Object.values(translation).find(Boolean);
}

// Replace `{{ name }}` placeholders in a description with their resolved values. Mirrors the core's
// VariableManager: array values join with ', ', and unknown tokens (no matching key) are left as-is.
export function resolveVariables(text: string, vars: Record<string, string | string[]>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    if (!Object.hasOwn(vars, name)) {
      return match;
    }

    const value = vars[name];

    return Array.isArray(value) ? value.join(', ') : value;
  });
}

// Build the variable map used to resolve `{{ tokens }}` in a section description, from a template's
// global variables, its colorsList (expanded to 1-indexed `color1..colorN`), and the user's form
// answers. Form answers win over global defaults for the same key.
export function buildDescriptionVars(
  variables: Record<string, string | string[]> | undefined,
  formData: Record<string, string> | undefined
): Record<string, string | string[]> {
  const vars: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(variables ?? {})) {
    if (key === 'colorsList') {
      const list = Array.isArray(value) ? value : [];

      for (const [i, color] of list.entries()) {
        vars[`color${i + 1}`] = color;
      }

      continue;
    }

    vars[key] = value;
  }

  for (const [key, value] of Object.entries(formData ?? {})) {
    vars[key] = value;
  }

  return vars;
}
