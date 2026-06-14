import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FileText, Video, Music, Check, ChevronRight, ChevronLeft, Pencil, Sparkles, X } from 'lucide-react';
import { Button, Card } from '@/presentation/components/ui';
import { TemplateForm } from '@/presentation/components/TemplateForm';
import { StepClip } from '@/presentation/components/builder/StepClip';
import { MediaPicker } from '@/presentation/components/admin/MediaPicker';
import { templateService, type Template, type InputSection } from '@/services/templateService';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { resolveTranslation, resolveVariables, buildDescriptionVars } from '@/lib/i18nText';
import { cn } from '@/lib/utils';

// The single-page "all at once" wizard shape. Mirrors the Expo TemplateDetailScreen in web glass:
// a progress bar over the input sections (+ media), one row per section, each opening a focused
// modal that reuses the SAME StepForm/StepClip/StepMedia screens as the linear flow.

export interface SectionHubModel {
  clipsBySection: Record<string, File>;
  editsBySection: Record<string, VideoEdit | undefined>;
  formData: Record<string, string>;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
}

interface SectionHubProps {
  template: Template;
  model: SectionHubModel;
  clipCount: number;
  showMediaRow: boolean;
  allComplete: boolean;
  onFormDataChange: (d: Record<string, string>) => void;
  onClipChange: (sectionName: string, file: File | undefined) => void;
  onEditChange: (sectionName: string, edit: VideoEdit | undefined) => void;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onCreate: () => void;
  onChangeTemplate: () => void;
  t: TFunction<'builder'>;
}

// Active focused panel: an input section by name, or the media picker.
type ActivePanel = { kind: 'section'; section: InputSection } | { kind: 'media' } | null;

const sectionComplete = (template: Template, section: InputSection, model: SectionHubModel): boolean => {
  if (section.kind === 'clip') return Boolean(model.clipsBySection[section.name]);
  const fields = templateService.extractFormFieldsForSection(template.descriptor, section.name);

  return fields.every((f) => (model.formData[f.name] ?? '').trim() !== '');
};

const mediaComplete = (model: SectionHubModel): boolean => Boolean(model.musicChoice ?? model.backgroundChoice);

interface HubRowProps {
  icon: typeof FileText;
  // 1-based position in the template's order. Surfacing it keeps the all-at-once view honest about
  // sequence — the hub's whole reason to exist is "work the template in order".
  index: number;
  title: string;
  subtitle?: string;
  done: boolean;
  onOpen: () => void;
  // Staggers the row's entrance so the list cascades in on first paint.
  delayMs: number;
  t: TFunction<'builder'>;
}

// One tappable section row: a numbered node (→ check when done), the section type + title/subtitle,
// and a chevron affordance. Lifts and presses so it reads as obviously interactive.
const HubRow = ({ icon: Icon, index, title, subtitle, done, onOpen, delayMs, t }: HubRowProps) => (
  <button
    type="button"
    onClick={onOpen}
    style={{ animationDelay: `${delayMs}ms` }}
    className={cn(
      'fade-in group flex w-full items-center gap-4 rounded-2xl border p-4 text-left min-h-[4.5rem]',
      'border-foreground/10 bg-foreground/5 transition-all duration-200 motion-reduce:transition-none',
      'hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-foreground/[0.08] hover:shadow-lg hover:shadow-black/5',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      'active:translate-y-0 active:scale-[0.99]',
      done && 'border-success/30 bg-success/[0.06]'
    )}
  >
    <span
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold tabular-nums transition-colors duration-200 motion-reduce:transition-none',
        done ? 'bg-success/15 text-success-foreground' : 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
      )}
    >
      {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : index}
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="truncate font-semibold text-foreground">{title}</span>
      </span>
      {subtitle && <span className="mt-0.5 block truncate text-sm text-gray-400">{subtitle}</span>}
    </span>
    <span className="flex shrink-0 items-center gap-2 text-gray-400">
      <span className="hidden items-center gap-1.5 text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none sm:flex">
        <Pencil className="h-3.5 w-3.5" />
        {t('actions.edit', { ns: 'common' })}
      </span>
      <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </span>
  </button>
);

interface PanelBodyProps extends SectionHubProps {
  panel: ActivePanel;
}

// Renders the focused screen for the active panel inside the modal. Early returns keep branches flat.
const PanelBody = (p: PanelBodyProps) => {
  const { panel, template, model } = p;

  if (!panel) return null;

  if (panel.kind === 'media') {
    return (
      <MediaPanel
        template={template}
        model={model}
        onMusic={p.onMusicChange}
        onBackground={p.onBackgroundChange}
        t={p.t}
      />
    );
  }

  const { section } = panel;

  // The sheet supplies the header/container, so render the bare bodies — TemplateForm with a
  // sectionName already returns just the scoped fields, and StepClip drops its page chrome.
  if (section.kind === 'form') {
    return (
      <TemplateForm
        template={template}
        sectionName={section.name}
        formData={model.formData}
        onFormDataChange={p.onFormDataChange}
      />
    );
  }

  const descriptorSection = (template.descriptor.sections ?? []).find((s) => s.name === section.name);

  if (!descriptorSection) return null;

  return (
    <StepClip
      chrome={false}
      section={descriptorSection}
      vars={buildDescriptionVars(template.descriptor.global?.variables, model.formData)}
      clipNumber={section.clipIndex + 1}
      totalClips={p.clipCount}
      file={model.clipsBySection[section.name]}
      onFileChange={(file) => {
        p.onClipChange(section.name, file);
      }}
      edit={model.editsBySection[section.name]}
      onEditChange={(edit) => {
        p.onEditChange(section.name, edit);
      }}
    />
  );
};

interface MediaPanelProps {
  template: Template;
  model: SectionHubModel;
  onMusic: (c: MediaChoice | null) => void;
  onBackground: (c: MediaChoice | null) => void;
  t: TFunction<'builder'>;
}

// Music + background pickers shown inside the hub modal. Mirrors StepMedia, scoped for the panel.
const MediaPanel = ({ template, model, onMusic, onBackground, t }: MediaPanelProps) => {
  const g = template.descriptor.global ?? {};
  const showMusic = (g.allowedMusic?.length ?? 0) > 0 || Boolean(g.allowUploadMusic);
  const showBackground = (g.allowedBackgrounds?.length ?? 0) > 0 || Boolean(g.allowUploadBackground);

  return (
    <div className="space-y-6">
      {showMusic && (
        <div>
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">{t('stepMedia.music')}</h3>
          <MediaPicker
            kind="music"
            value={model.musicChoice}
            onChange={onMusic}
            allowedIds={g.allowedMusic}
            allowUpload={Boolean(g.allowUploadMusic)}
          />
        </div>
      )}
      {showBackground && (
        <div>
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">{t('stepMedia.background')}</h3>
          <MediaPicker
            kind="picture"
            value={model.backgroundChoice}
            onChange={onBackground}
            allowedIds={g.allowedBackgrounds}
            allowUpload={Boolean(g.allowUploadBackground)}
          />
        </div>
      )}
    </div>
  );
};

const clipSubtitle = (
  section: InputSection,
  clipCount: number,
  vars: Record<string, string | string[]>,
  locale: string,
  t: TFunction<'builder'>
): string => {
  // A clip's description carries its prompt (e.g. the Konbini "Tea or Coffee?"); show it so the
  // recorder knows which question this answer is for. Falls back to the clip position. The prompt is
  // resolved to the current locale, then its {{ tokens }} substituted with the real values.
  const question = resolveTranslation(section.description, locale)?.trim();

  if (question) return resolveVariables(question, vars);

  if (clipCount > 1) return t('hub.clipOf', { number: section.clipIndex + 1, total: clipCount });

  return t('hub.recordOrUpload');
};

// Accessible heading for the focused-section dialog (Radix requires a DialogTitle).
const panelHeading = (panel: ActivePanel, locale: string, t: TFunction<'builder'>): string => {
  if (panel?.kind === 'media') return t('hub.mediaHeading');

  if (panel?.kind === 'section') {
    return (
      resolveTranslation(panel.section.title, locale) ??
      (panel.section.kind === 'clip' ? t('hub.recordClip') : t('hub.yourDetails'))
    );
  }

  return t('hub.section');
};

// One-line context shown under the sheet heading, scoped to the active panel.
const sheetSubtitle = (
  panel: ActivePanel,
  p: SectionHubProps,
  vars: Record<string, string | string[]>,
  locale: string
): string | undefined => {
  if (!panel) return undefined;

  if (panel.kind === 'media') return p.t('hub.mediaSubtitle');

  if (panel.section.kind === 'form') return p.t('stepForm.subtitle');

  return clipSubtitle(panel.section, p.clipCount, vars, locale, p.t);
};

// Section-type glyph for the sheet header node — ties the sheet back to its hub row.
const sheetIcon = (panel: ActivePanel): typeof FileText => {
  if (panel?.kind === 'media') return Music;

  if (panel?.kind === 'section' && panel.section.kind === 'clip') return Video;

  return FileText;
};

const panelDone = (panel: ActivePanel, template: Template, model: SectionHubModel): boolean => {
  if (!panel) return false;

  if (panel.kind === 'media') return mediaComplete(model);

  return sectionComplete(template, panel.section, model);
};

interface SectionSheetProps extends SectionHubProps {
  panel: NonNullable<ActivePanel>;
  onClose: () => void;
}

// The focused editing surface: a bottom sheet on mobile, a right-anchored side sheet on desktop —
// NOT a centered modal and NOT a Radix Dialog, so the clip recorder's full-screen portal (z-[60])
// keeps working over it. Mounted ONLY while a section is open (so it never lingers as a ghost layer
// peeking from the edge); it mounts off-screen and slides in on the next frame. On desktop there is
// no scrim — the hub stays fully visible and interactive on the left.
const SectionSheet = (p: SectionSheetProps) => {
  const { panel, onClose, template, model, t } = p;
  const { i18n } = useTranslation('builder');
  const [entered, setEntered] = useState(false);

  // Read the latest onClose via a ref. Depending on onClose directly (a fresh closure each parent
  // render) would re-run the effect on every keystroke — which previously stole focus back to the
  // close button mid-typing and re-subscribed the listener.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount off-screen, then flip to on-screen on the next frame so the transform transition plays.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setEntered(true);
    });

    return () => {
      cancelAnimationFrame(id);
    };
  }, []);

  // Escape closes the sheet (subscribed once; no auto-focus so the body's first field stays typable).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const vars = buildDescriptionVars(template.descriptor.global?.variables, model.formData);
  const heading = panelHeading(panel, i18n.language, t);
  const subtitle = sheetSubtitle(panel, p, vars, i18n.language);
  const done = panelDone(panel, template, model);
  const HeadIcon = sheetIcon(panel);

  // Portal to <body>: the hub sits inside a `fade-in`/`max-w-3xl` wrapper whose animation establishes
  // a containing block, which would otherwise anchor this `position: fixed` sheet to that centered
  // 768px box instead of the viewport (sheet floats mid-screen, wrong width). Same reason the camera
  // recorder portals out.
  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 motion-reduce:transition-none sm:hidden',
          entered ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        role="dialog"
        aria-label={heading}
        className={cn(
          'fixed z-50 flex flex-col bg-surface shadow-2xl transition-transform duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
          // Physical inset props only (no logical `inset-x`/`inset-y` mixing). Mobile = bottom sheet.
          'bottom-0 left-0 right-0 top-12 rounded-t-3xl border-t border-divider',
          // Desktop = right-anchored side sheet (left:auto so translate-x-full clears its own width).
          'sm:bottom-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[28rem] sm:max-w-[90vw] sm:rounded-none sm:border-l sm:border-t-0',
          entered ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden" />
        <div className="flex items-start gap-3 border-b border-divider px-6 py-4 md:px-8">
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-200 motion-reduce:transition-none',
              done ? 'bg-success/15 text-success-foreground' : 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
            )}
          >
            {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <HeadIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-bold leading-tight text-foreground">{heading}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-gray-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label={t('actions.close', { ns: 'common' })}
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 motion-reduce:transition-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8">
          <PanelBody {...p} panel={panel} />
        </div>
      </div>
    </>,
    document.body
  );
};

export const SectionHub = (props: Omit<SectionHubProps, 't'>) => {
  const { template, model, clipCount, showMediaRow, allComplete, onCreate, onChangeTemplate } = props;
  const { t, i18n } = useTranslation('builder');
  const [panel, setPanel] = useState<ActivePanel>(null);
  const sections = templateService.orderedInputSections(template.descriptor);
  const vars = buildDescriptionVars(template.descriptor.global?.variables, model.formData);

  const mediaItems = showMediaRow ? 1 : 0;
  const mediaDone = showMediaRow && mediaComplete(model) ? 1 : 0;
  const totalItems = sections.length + mediaItems;
  const doneItems = sections.filter((s) => sectionComplete(template, s, model)).length + mediaDone;
  const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 100;
  const remaining = totalItems - doneItems;

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <div className="mb-8">
        <button
          type="button"
          onClick={onChangeTemplate}
          className="mb-5 inline-flex items-center gap-1 rounded-md text-sm font-medium text-gray-400 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 motion-reduce:transition-none"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('hub.changeTemplate')}
        </button>
        <div className="text-center">
          <h2 className="mb-2 font-display text-4xl font-bold text-foreground">{template.name}</h2>
          <p className="text-lg text-gray-400">{t('hub.subtitle')}</p>
        </div>
      </div>

      <Card elevation="flat" className="glass-panel-dark space-y-6 p-6 shadow-2xl md:p-8">
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full brand-gradient transition-all duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-400">
            {t('hub.completed', { count: totalItems, done: doneItems })}
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section, i) => (
            <HubRow
              key={section.name}
              index={i + 1}
              delayMs={i * 60}
              icon={section.kind === 'clip' ? Video : FileText}
              title={
                resolveTranslation(section.title, i18n.language) ??
                (section.kind === 'clip' ? t('steps.clip', { number: section.clipIndex + 1 }) : t('hub.yourDetails'))
              }
              subtitle={
                section.kind === 'clip'
                  ? clipSubtitle(section, clipCount, vars, i18n.language, t)
                  : resolveTranslation(section.description, i18n.language)
              }
              done={sectionComplete(template, section, model)}
              onOpen={() => {
                setPanel({ kind: 'section', section });
              }}
              t={t}
            />
          ))}
          {showMediaRow && (
            <HubRow
              index={sections.length + 1}
              delayMs={sections.length * 60}
              icon={Music}
              title={t('stepMedia.title')}
              subtitle={mediaComplete(model) ? t('hub.selectionSaved') : t('hub.mediaSubtitleShort')}
              done={mediaComplete(model)}
              onOpen={() => {
                setPanel({ kind: 'media' });
              }}
              t={t}
            />
          )}
        </div>

        <div className="space-y-3">
          <Button
            variant="primary"
            onClick={onCreate}
            disabled={!allComplete}
            className={cn(
              'group w-full px-8 py-3.5 active:translate-y-0 active:scale-[0.98]',
              allComplete && 'shadow-lg shadow-brand-500/30 ring-1 ring-brand-400/30'
            )}
          >
            <Sparkles className="h-5 w-5" />
            {t('hub.createCta')}
          </Button>
          {allComplete ? (
            <p
              aria-live="polite"
              className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-success-foreground"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              {t('hub.ready')}
            </p>
          ) : (
            <p aria-live="polite" className="text-center text-sm text-gray-400">
              {t('hub.remaining', { count: remaining })}
            </p>
          )}
        </div>
      </Card>

      {panel !== null && (
        <SectionSheet
          key={panel.kind === 'section' ? panel.section.name : 'media'}
          {...props}
          t={t}
          panel={panel}
          onClose={() => {
            setPanel(null);
          }}
        />
      )}
    </div>
  );
};
