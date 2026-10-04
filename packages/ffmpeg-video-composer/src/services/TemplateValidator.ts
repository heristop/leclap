import {
  TemplateDescriptorSchema,
  SectionSchema,
  FilterValuesSchema,
  type TemplateDescriptor,
  type Section,
} from '../schemas/template.schemas';
import { findUnknownKeys, type UnknownKey } from './validation/schema-walk';
import { knownNames, referenceFinding } from './validation/reference-finding';
import {
  dedupeFindings,
  unknownKeyFinding,
  zodIssueFindings,
  zodIssues,
  withoutHostFields,
  type IssueSource,
} from './validation/zod-findings';
import { validateDescriptorRules, type ValidationError } from './template-validation-rules';
import { expandPartialsSafe } from '@/core/partials';
import { resolveThemeDescriptor } from '@/core/theme/resolve';
import { findAccentOveruse } from '@/core/theme/accent';
import type { GeometryWarning, FontLoader } from './geometry';

export type { ValidationError } from './template-validation-rules';
export type { GeometryWarning, FontLoader } from './geometry';

export interface ValidationResult {
  success: boolean;
  data?: TemplateDescriptor | Section;
  errors?: ValidationError[];
}

// Raw FFmpeg filter values are forwarded key-by-key to the filter (FormatterManager), so any
// drawtext/drawbox option is legal there even when the schema does not name it.
const FREE_FORM_SCHEMAS: ReadonlySet<unknown> = new Set([FilterValuesSchema]);

export class TemplateValidator {
  private formatZodError(error: IssueSource, data?: unknown, unknownKeys: UnknownKey[] = []): ValidationError[] {
    try {
      return zodIssueFindings(zodIssues(error), data, unknownKeys);
    } catch (mapError) {
      return [
        {
          path: 'format_error',
          message: mapError instanceof Error ? mapError.message : 'Error formatting Zod errors',
          code: 'format_error',
        },
      ];
    }
  }

  // Every schema finding in one pass: zod's issues plus the unknown keys a strip object dropped.
  // `envelope`: the data is a whole descriptor, whose top level hosts may extend with their own fields.
  private schemaErrors(
    schema: unknown,
    data: unknown,
    error: IssueSource | undefined,
    envelope = false
  ): ValidationError[] {
    const found = findUnknownKeys(schema, data, { freeForm: FREE_FORM_SCHEMAS });
    const unknownKeys = envelope ? withoutHostFields(found) : found;
    const issues = error ? this.formatZodError(error, data, unknownKeys) : [];
    const keyFindings = unknownKeys.map((entry) => unknownKeyFinding(entry.path.join('.'), entry.key, entry.allowed));

    return dedupeFindings([...issues, ...keyFindings]);
  }

  private validateVariableReferences(template: TemplateDescriptor): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!template.global?.variables) {
      return errors;
    }

    const definedVariables = new Set(Object.keys(template.global.variables));

    const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;

    function checkVariableReferences(obj: unknown, path = ''): void {
      if (typeof obj === 'string') {
        let match;

        while ((match = variablePattern.exec(obj)) !== null) {
          const variable = match[1];

          if (!definedVariables.has(variable)) {
            errors.push(
              referenceFinding(path, `Undefined variable reference: ${variable}`, 'undefined_variable', {
                name: variable,
                known: [...definedVariables],
                fix: `define "${variable}" in global.variables`,
              })
            );
          }
        }

        return;
      }

      if (Array.isArray(obj)) {
        for (let index = 0; index < obj.length; index++) {
          checkVariableReferences(obj[index], `${path}[${index}]`);
        }

        return;
      }

      if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          const newPath = path ? `${path}.${key}` : key;
          checkVariableReferences(value, newPath);
        }
      }
    }

    checkVariableReferences(template, 'template');

    return errors;
  }

  private validateSectionReferences(template: TemplateDescriptor): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!template.sections || !Array.isArray(template.sections)) {
      return errors;
    }

    const sectionNames = new Set(template.sections.map((section) => section.name));

    for (let index = 0; index < template.sections.length; index++) {
      const section = template.sections[index];

      if (section.type !== 'effect' && section.options?.useVideoSection) {
        const referencedSection = section.options.useVideoSection;

        if (!sectionNames.has(referencedSection)) {
          errors.push(
            referenceFinding(
              `sections[${index}].options.useVideoSection`,
              `Referenced section "${referencedSection}" does not exist`,
              'undefined_section_reference',
              { name: referencedSection, known: knownNames(sectionNames), fix: 'point it at an existing section name' }
            )
          );
        }
      }
    }

    return errors;
  }

  validateTemplate(templateData: unknown): ValidationResult {
    // Expand `{ type: "partial", ref }` sections to real sections first, so the schema + reference
    // checks (and the engine downstream) only ever see real sections.
    const expansion = expandPartialsSafe(templateData);

    if (!expansion.ok) {
      return { success: false, errors: [expansion.error] };
    }

    return this.validateParsed(expansion.data);
  }

  private validateParsed(templateData: unknown): ValidationResult {
    try {
      let result;

      try {
        result = TemplateDescriptorSchema.safeParse(templateData);
      } catch (zodError) {
        return {
          success: false,
          errors: [
            {
              path: 'zod_parse',
              message: zodError instanceof Error ? zodError.message : 'Zod parsing error',
              code: 'zod_error',
            },
          ],
        };
      }

      // Unknown keys are reported even when the parse succeeded: a strip object drops them silently.
      const schemaErrors = this.schemaErrors(TemplateDescriptorSchema, templateData, result.error, true);

      // The descriptor rules read typed data, so they only run once the schema parse succeeded.
      if (!result.success) {
        return { success: false, errors: schemaErrors };
      }

      const template = result.data;

      try {
        // Only validate section references as hard errors
        // Variable references are warnings since templates often use runtime variables
        const allErrors = [...schemaErrors, ...this.collectDescriptorErrors(template)];

        if (allErrors.length > 0) {
          return {
            success: false,
            data: template,
            errors: allErrors,
          };
        }

        return {
          success: true,
          data: template,
        };
      } catch (error) {
        return {
          success: false,
          errors: [
            {
              path: 'custom_validation',
              message: error instanceof Error ? error.message : 'Error in custom validation',
              code: 'custom_validation_error',
            },
          ],
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            path: 'root',
            message: error instanceof Error ? error.message : 'Unknown validation error',
            code: 'validation_error',
          },
        ],
      };
    }
  }

  // Runs every descriptor-level rule (beyond the zod schema itself) and merges their errors. Extracted
  // out of validateParsed to keep that function under the statement-count lint budget. The rules see the
  // theme-resolved descriptor (what the engine lowers), so `$font.display` is checked as the font it names.
  private collectDescriptorErrors(template: TemplateDescriptor): ValidationError[] {
    return [...this.validateSectionReferences(template), ...validateDescriptorRules(resolveThemeDescriptor(template))];
  }

  validateSection(sectionData: unknown): ValidationResult {
    try {
      const result = SectionSchema.safeParse(sectionData);
      const errors = this.schemaErrors(SectionSchema, sectionData, result.error);

      if (!result.success || errors.length > 0) {
        return { success: false, errors };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            path: 'root',
            message: error instanceof Error ? error.message : 'Unknown validation error',
            code: 'validation_error',
          },
        ],
      };
    }
  }

  async validateTemplateFromFile(filePath: string): Promise<ValidationResult> {
    if (process.env.PLATFORM === 'browser') {
      return {
        success: false,
        errors: [
          {
            path: 'file',
            message: 'File system operations are only supported in Node.js environment',
            code: 'unsupported_environment',
          },
        ],
      };
    }

    try {
      const fs = await import('node:fs');
      const templateContent = fs.readFileSync(filePath, 'utf-8');
      const templateData = JSON.parse(templateContent);

      return this.validateTemplate(templateData);
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            path: 'file',
            message: error instanceof Error ? error.message : 'Failed to read or parse template file',
            code: 'file_error',
          },
        ],
      };
    }
  }

  validateTemplateFromJSON(jsonString: string): ValidationResult {
    try {
      const templateData = JSON.parse(jsonString);

      return this.validateTemplate(templateData);
    } catch {
      return {
        success: false,
        errors: [
          {
            path: 'json',
            message: 'Invalid JSON format',
            code: 'json_parse_error',
          },
        ],
      };
    }
  }

  getVariableWarnings(template: TemplateDescriptor): ValidationError[] {
    return this.validateVariableReferences(template);
  }

  // Advisory: sections that spread the theme accent over too many elements (core/theme/accent.ts).
  getThemeWarnings(template: TemplateDescriptor): ValidationError[] {
    return findAccentOveruse(template);
  }

  // Advisory, exactly like getVariableWarnings: geometry findings never enter `errors` and never
  // flip `success`. A template that renders badly still renders, so this is guidance, not a gate.
  // Lazily loaded: the geometry graph (font metrics, colour-contrast math, caption layout) is only
  // ever called from Node consumers, and a static import on a class method can't be tree-shaken out
  // of the browser and React Native chunks. `collectGeometryWarnings` expands partials itself, so a
  // caller that skipped `validateTemplate` still gets the partial's sections measured.
  async getGeometryWarnings(template: TemplateDescriptor, loadFont?: FontLoader): Promise<GeometryWarning[]> {
    const { collectGeometryWarnings } = await import('./geometry');

    return collectGeometryWarnings(template, loadFont);
  }

  getValidationSummary(result: ValidationResult): string {
    if (result.success) {
      return 'Template validation passed';
    }

    const errorCount = result.errors?.length ?? 0;
    const errorSummary = result.errors
      ?.slice(0, 3)
      .map((err) => `${err.path}: ${err.message}`)
      .join('; ');

    return `Template validation failed with ${errorCount} error(s): ${errorSummary}${errorCount > 3 ? '...' : ''}`;
  }
}
