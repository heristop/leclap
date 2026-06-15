import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  FileText,
  Video,
  Music,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Card } from '@/presentation/components/ui';
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
  // The first not-yet-complete row — gets a brand accent bar + "Next up" badge so the eye lands on
  // the one thing left to do.
  isNext: boolean;
  onOpen: () => void;
  // Staggers the row's entrance so the list cascades in on first paint.
  delayMs: number;
  t: TFunction<'builder'>;
}

// One tappable section row: a numbered node (→ check when done), the section type + title/subtitle,
// and a chevron affordance. Sits on a lighter surface than the glass card so the rows read as items
// on a panel rather than nested glass. Lifts and presses so it reads as obviously interactive.
const HubRow = ({ icon: Icon, index, title, subtitle, done, isNext, onOpen, delayMs, t }: HubRowProps) => (
  <button
    type="button"
    onClick={onOpen}
    style={{ animationDelay: `${delayMs}ms` }}
    className={cn(
      'fade-in group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-4 pl-5 text-left min-h-[4.5rem]',
      'border-foreground/10 bg-surface/50 transition-all duration-200 motion-reduce:transition-none',
      'hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-surface/80 hover:shadow-lg hover:shadow-black/5',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      'active:translate-y-0 active:scale-[0.99]',
      isNext && !done && 'border-brand-500/40 bg-brand-500/[0.04]',
      done && 'border-success/30 bg-success/[0.06]'
    )}
  >
    {isNext && !done && <span aria-hidden="true" className="brand-gradient absolute inset-y-0 left-0 w-1" />}
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
        <span className="line-clamp-2 font-semibold text-foreground">{title}</span>
        {isNext && !done && (
          <Badge variant="brand" className="shrink-0">
            {t('hub.next')}
          </Badge>
        )}
      </span>
      {subtitle && <span className="mt-0.5 block line-clamp-1 text-sm text-gray-400">{subtitle}</span>}
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
      orientation={template.descriptor.global?.orientation === 'portrait' ? 'portrait' : 'landscape'}
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
  // Step to the previous/next section without closing the sheet (undefined at the ends). `position`
  // drives the "2 / 3" indicator.
  onPrev?: () => void;
  onNext?: () => void;
  position: { index: number; total: number };
}

// The focused editing surface: a bottom sheet on mobile, a right-anchored side sheet on desktop —
// True for form fields / selects / contenteditable, where ↑/↓ must keep their native behaviour.
// Whether ↑/↓ should be left to the focused field instead of navigating sections. A single-line text
// input is NOT blocked: there ↑/↓ only jog the caret to start/end, so section nav still works while
// the form's name field is focused (the common case). Fields where ↑/↓ have real native meaning are
// left alone: multi-line textareas, native selects, contentEditable, and number/range/date spinners.
const NATIVE_ARROW_INPUT_TYPES = ['number', 'range', 'date', 'time', 'datetime-local', 'week', 'month'];

function arrowNavBlocked(el: HTMLElement | null): boolean {
  const tag = el?.tagName;

  if (tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el?.isContentEditable)) return true;

  if (tag === 'INPUT') return NATIVE_ARROW_INPUT_TYPES.includes((el as HTMLInputElement).type);

  return false;
}

// Past this many pixels of downward drag, releasing dismisses the mobile bottom sheet.
const CLOSE_THRESHOLD = 120;

// Drag-to-dismiss (mobile only): follow the finger downward, then close past the threshold or snap
// back. `dragY === null` means not dragging — the sheet's CSS transition drives it; a number means a
// live drag, so the caller overrides transform inline and kills the transition for 1:1 tracking.
function useDragToDismiss(onClose: () => void) {
  const [dragY, setDragY] = useState<number | null>(null);
  const dragStartRef = useRef<number | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    dragStartRef.current = e.clientY;
    setDragY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (dragStartRef.current === null) return;

    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  };

  const onDragEnd = () => {
    if (dragStartRef.current === null) return;

    const shouldClose = (dragY ?? 0) > CLOSE_THRESHOLD;
    dragStartRef.current = null;

    if (shouldClose) {
      onClose();

      return;
    }

    setDragY(null);
  };

  return { dragY, onDragStart, onDragMove, onDragEnd };
}

// NOT a centered modal and NOT a Radix Dialog, so the clip recorder's full-screen portal (z-[60])
// keeps working over it. Mounted ONLY while a section is open (so it never lingers as a ghost layer
// peeking from the edge); it mounts off-screen and slides in on the next frame. On desktop there is
// no scrim — the hub stays fully visible and interactive on the left.
const SectionSheet = (p: SectionSheetProps) => {
  const { panel, onClose, onPrev, onNext, position, template, model, t } = p;
  const { i18n } = useTranslation('builder');
  const [entered, setEntered] = useState(false);
  const { dragY, onDragStart, onDragMove, onDragEnd } = useDragToDismiss(onClose);

  // Read the latest onClose via a ref. Depending on onClose directly (a fresh closure each parent
  // render) would re-run the effect on every keystroke — which previously stole focus back to the
  // close button mid-typing and re-subscribed the listener.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Latest prev/next via refs so the keydown listener can stay subscribed once (these are fresh
  // closures each parent render).
  const onPrevRef = useRef(onPrev);
  onPrevRef.current = onPrev;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // Mount off-screen, then flip to on-screen on the next frame so the transform transition plays.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setEntered(true);
    });

    return () => {
      cancelAnimationFrame(id);
    };
  }, []);

  // Keyboard: Escape closes; ↑/↓ step to the previous/next section. Subscribed on `window` so it
  // works without first focusing the sheet, and left to the field only for textareas / selects /
  // number-style inputs (see arrowNavBlocked); plain Tab/Shift+Tab keep their field-to-field behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();

        return;
      }

      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      if (arrowNavBlocked(e.target as HTMLElement | null)) return;

      e.preventDefault();

      if (e.key === 'ArrowUp') onPrevRef.current?.();

      if (e.key === 'ArrowDown') onNextRef.current?.();
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
        style={
          dragY === null ? undefined : { opacity: Math.max(0, 1 - dragY / (CLOSE_THRESHOLD * 2)), transition: 'none' }
        }
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 motion-reduce:transition-none sm:hidden',
          entered ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        role="dialog"
        aria-label={heading}
        style={dragY === null ? undefined : { transform: `translateY(${dragY}px)`, transition: 'none' }}
        className={cn(
          'fixed z-50 flex flex-col bg-surface shadow-2xl transition-transform duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
          // Physical inset props only (no logical `inset-x`/`inset-y` mixing). Mobile = bottom sheet.
          'bottom-0 left-0 right-0 top-12 rounded-t-3xl border-t border-divider',
          // Desktop = right-anchored side sheet (left:auto so translate-x-full clears its own width).
          'sm:bottom-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[28rem] sm:max-w-[90vw] sm:rounded-none sm:border-l sm:border-t-0',
          entered ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
        )}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="shrink-0 cursor-grab touch-none pb-1 pt-3 active:cursor-grabbing sm:hidden"
        >
          <div aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-foreground/20" />
        </div>
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
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={t('hub.prevSection')}
              title={t('hub.prevSection')}
              onClick={onPrev}
              disabled={!onPrev}
              className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="px-0.5 text-xs font-medium tabular-nums text-gray-400" aria-hidden="true">
              {position.index + 1}/{position.total}
            </span>
            <button
              type="button"
              aria-label={t('hub.nextSection')}
              title={t('hub.nextSection')}
              onClick={onNext}
              disabled={!onNext}
              className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t('actions.close', { ns: 'common' })}
              onClick={onClose}
              className="ml-0.5 grid h-9 w-9 place-items-center rounded-full text-gray-400 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 motion-reduce:transition-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8">
          <div key={panel.kind === 'section' ? panel.section.name : 'media'} className="fade-in">
            <PanelBody {...p} panel={panel} />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

// Progress across the input sections (+ optional media row), shown by the hub's bar and counters.
function hubProgress(sections: InputSection[], template: Template, model: SectionHubModel, showMediaRow: boolean) {
  const mediaItems = showMediaRow ? 1 : 0;
  const mediaDone = showMediaRow && mediaComplete(model) ? 1 : 0;
  const totalItems = sections.length + mediaItems;
  const doneItems = sections.filter((s) => sectionComplete(template, s, model)).length + mediaDone;
  const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 100;

  return { totalItems, doneItems, progress, remaining: totalItems - doneItems };
}

// The first not-yet-complete item drives the "Next up" cue. Sections come first, then the media row;
// media is "next" only once every section is done.
function nextCue(sections: InputSection[], template: Template, model: SectionHubModel, showMediaRow: boolean) {
  const nextSectionIndex = sections.findIndex((section) => !sectionComplete(template, section, model));
  const mediaIsNext = showMediaRow && nextSectionIndex === -1 && !mediaComplete(model);

  return { nextSectionIndex, mediaIsNext };
}

// Ordered panels (input sections + optional media) backing the sheet's prev/next navigation.
function buildPanels(sections: InputSection[], showMediaRow: boolean): NonNullable<ActivePanel>[] {
  return [
    ...sections.map((section): NonNullable<ActivePanel> => ({ kind: 'section', section })),
    ...(showMediaRow ? [{ kind: 'media' } as NonNullable<ActivePanel>] : []),
  ];
}

export const SectionHub = (props: Omit<SectionHubProps, 't'>) => {
  const { template, model, clipCount, showMediaRow, allComplete, onCreate, onChangeTemplate } = props;
  const { t, i18n } = useTranslation('builder');
  const [panel, setPanel] = useState<ActivePanel>(null);
  const sections = templateService.orderedInputSections(template.descriptor);
  const vars = buildDescriptionVars(template.descriptor.global?.variables, model.formData);

  const { totalItems, doneItems, progress, remaining } = hubProgress(sections, template, model, showMediaRow);

  const { nextSectionIndex, mediaIsNext } = nextCue(sections, template, model, showMediaRow);

  const panels = buildPanels(sections, showMediaRow);
  const panelKeyOf = (pp: NonNullable<ActivePanel>): string => (pp.kind === 'section' ? pp.section.name : 'media');
  const panelIndex = panel ? panels.findIndex((pp) => panelKeyOf(pp) === panelKeyOf(panel)) : -1;

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
              isNext={i === nextSectionIndex}
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
              isNext={mediaIsNext}
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
          {...props}
          t={t}
          panel={panel}
          position={{ index: panelIndex, total: panels.length }}
          onPrev={
            panelIndex > 0
              ? () => {
                  setPanel(panels[panelIndex - 1]);
                }
              : undefined
          }
          onNext={
            panelIndex >= 0 && panelIndex < panels.length - 1
              ? () => {
                  setPanel(panels[panelIndex + 1]);
                }
              : undefined
          }
          onClose={() => {
            setPanel(null);
          }}
        />
      )}
    </div>
  );
};
