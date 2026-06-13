import { TemplateForm } from '@/presentation/components/TemplateForm';
import { Card } from '@/presentation/components/ui';
import type { Template, Translation } from '@/services/templateService';

interface StepFormProps {
  template: Template;
  // The `form` section whose fields this step collects.
  section: { name: string; title?: Translation };
  formData: Record<string, string>;
  onFormDataChange: (formData: Record<string, string>) => void;
}

// One focused screen for a single form section's fields. Reuses TemplateForm scoped by section name.
export const StepForm = ({ template, section, formData, onFormDataChange }: StepFormProps) => {
  const title = section.title?.en ?? 'Your details';

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <h2 className="mb-2 font-display text-4xl font-bold text-foreground">{title}</h2>
        <p className="text-lg text-gray-400">Fill in the details for this part</p>
      </div>
      <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl md:p-10">
        <TemplateForm
          template={template}
          sectionName={section.name}
          formData={formData}
          onFormDataChange={onFormDataChange}
        />
      </Card>
    </div>
  );
};
