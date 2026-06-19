import { useTranslation } from 'react-i18next';
import { type Template } from '@/services/templateService';
import { buildFieldLabels, humanizeKey } from './templateSummary';

interface CompileSummaryProps {
  template: Template;
  clipCount: number;
  formData: Record<string, string>;
}

// Small uppercase group label — quiet, subordinate to the render monitor.
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{children}</p>
);

// One fact in the tight meta row: a quiet label above its value.
const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <Eyebrow>{label}</Eyebrow>
    <p className="mt-0.5 truncate text-sm text-foreground capitalize">{value}</p>
  </div>
);

// A low-visual-weight project summary rail that frames the render monitor without competing with it:
// the project name + description, a tight row of facts, and (when present) the user's answers.
export const CompileSummary = ({ template, clipCount, formData }: CompileSummaryProps) => {
  const { t } = useTranslation(['process', 'builder']);
  const fieldLabels = buildFieldLabels(template);
  const answers = Object.entries(formData).filter(([, value]) => value.trim().length > 0);
  const sectionCount = template.descriptor.sections?.length ?? 0;
  const musicOn = template.descriptor.global?.musicEnabled ?? false;

  return (
    <aside className="fade-in space-y-5">
      <div>
        <Eyebrow>{t('builder:compile.project')}</Eyebrow>
        <h3 className="mt-1 font-display text-lg font-bold leading-tight text-foreground">{template.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-foreground/10 pt-4">
        <Fact label={t('process:processor.template.orientation')} value={template.orientation} />
        <Fact label={t('process:processor.template.sections')} value={sectionCount} />
        <Fact label={t('builder:compile.clips')} value={clipCount} />
        <Fact
          label={t('process:processor.template.music')}
          value={musicOn ? t('process:processor.template.musicEnabled') : t('process:processor.template.musicDisabled')}
        />
      </div>

      {answers.length > 0 && (
        <div className="border-t border-foreground/10 pt-4">
          <Eyebrow>{t('process:processor.template.formData')}</Eyebrow>
          <dl className="mt-2 space-y-1.5">
            {answers.map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-sm text-muted-foreground">{fieldLabels.get(key) ?? humanizeKey(key)}</dt>
                <dd className="min-w-0 truncate text-right text-sm text-foreground" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </aside>
  );
};
