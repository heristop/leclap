type PreviewForm = {
  sections: Array<{
    type: string;
    options?: { fields?: Array<{ name: string; label?: { en?: string }; maxLength?: number }> };
  }>;
};

export function fieldsFor(template: PreviewForm, defaults: Record<string, string>): Record<string, string> {
  const fields = { ...defaults };

  for (const section of template.sections.filter((section) => section.type === 'form')) {
    for (const field of section.options?.fields ?? []) {
      fields[field.name] ??= (field.label?.en ?? 'Your next story').slice(0, Math.min(field.maxLength ?? 32, 32));
    }
  }

  return fields;
}
