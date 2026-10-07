// @vitest-environment node
// The builder form renders one input per field; a field bound to a declared `global.fields` entry gets the
// control of its type (colour picker, number, select, URL). Rendered to static markup (no jsdom here).
import { beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import templates from '@/i18n/locales/en/templates.json';
import admin from '@/i18n/locales/en/admin.json';
import type { Template } from '@/services/templateService';
import { TemplateForm } from './TemplateForm';

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['templates', 'admin'],
    defaultNS: 'templates',
    resources: { en: { templates, admin } },
  });
});

function template(global: Record<string, unknown>): Template {
  return {
    id: 't',
    descriptor: {
      global,
      sections: [
        {
          name: 'f',
          type: 'form',
          options: { fields: [{ name: 'TITLE', maxLength: 20, label: { en: 'Title' } }] },
        },
      ],
    },
  } as unknown as Template;
}

function render(t: Template, formData: Record<string, string> = {}, sectionName?: string): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <TemplateForm template={t} formData={formData} onFormDataChange={() => {}} sectionName={sectionName} />
    </I18nextProvider>
  );
}

const typed = template({
  fields: {
    TITLE: { type: 'text', required: true },
    ACCENT: { type: 'color', default: '#ff5a36', label: { en: 'Accent colour' } },
    HOLD: { type: 'number', default: 3, min: 1, max: 8, label: { en: 'Hold' } },
    MOOD: { type: 'enum', options: ['calm', 'loud'], default: 'calm', label: { en: 'Mood' } },
    LINK: { type: 'url', label: { en: 'Link' } },
  },
});

describe('TemplateForm with declared fields', () => {
  it('renders the form field and every declared field with a control of its type', () => {
    const html = render(typed);

    expect(html).toContain('Title');
    expect(html).toContain('Accent colour');
    expect(html).toContain('type="number"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('type="url"');
  });

  it('keeps a scene step to its own section', () => {
    const html = render(typed, {}, 'f');

    expect(html).toContain('Title');
    expect(html).not.toContain('Accent colour');
  });

  it('reports a value that does not fit its type', () => {
    const html = render(typed, { HOLD: '12' });

    expect(html).toContain('above the maximum 8');
  });

  it('renders a template without declared fields as plain text inputs', () => {
    const html = render(template({}));

    expect(html).toContain('type="text"');
    expect(html).not.toContain('type="number"');
  });
});
