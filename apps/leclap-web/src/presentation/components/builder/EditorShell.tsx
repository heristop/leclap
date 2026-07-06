import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ChevronLeft,
  Clapperboard,
  Film,
  Layers,
  Monitor,
  Music,
  Proportions,
  Scissors,
  Sparkles,
  type LucideIcon,
} from '@/presentation/components/icons';
import { SegmentedControl } from '@/presentation/components/ui';
import { KineticHeading, GradientMeter, PressableScale, ratio01 } from '@/presentation/components/kinetic';
import {
  ToolDock,
  ProgramMonitor,
  MobileResizeHandle,
  useMobileSplit,
  type ToolItem,
} from '@/presentation/components/editor-shell';
import { templateService, type Template, type InputSection } from '@/services/templateService';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { resolveTranslation } from '@/lib/i18nText';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { withViewTransition } from '@/lib/viewTransition';
import { nextCue, hubProgress, type SceneModel } from './sceneStatus';
import { sectionKindMeta } from './sectionKind';
import { ScenePanel, MediaToolPanel, FormatPanel, orientationOf } from './editorPanels';
import { SectionPreview } from './SectionPreview';
import { SceneFilmstrip } from './SceneFilmstrip';
import { SaveStatusIndicator, type SaveStatus } from './SaveStatusIndicator';
import { TimelineEditor } from '@/features/editor/TimelineEditor';

type Tool = 'content' | 'media' | 'format';
type Phase = 'edit' | 'processing' | 'result';

interface EditorShellProps {
  template: Template;
  model: SceneModel;
  clipCount: number;
  showMedia: boolean;
  allComplete: boolean;
  phase: Phase;
  phaseContent: ReactNode;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  onFormDataChange: (d: Record<string, string>) => void;
  onClipChange: (sectionName: string, file: File | undefined) => void;
  onAddRush: (sectionName: string, file: File) => void;
  onSelectRush: (sectionName: string, file: File) => void;
  onRemoveRush: (sectionName: string, file: File) => void;
  onEditChange: (sectionName: string, edit: VideoEdit | undefined) => void;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onCreate: () => void;
  onCancel: () => void;
  onExit: () => void;
}

interface RailItem {
  tool: Tool;
  icon: LucideIcon;
  label: string;
}

// Render-readiness as the shared gradient meter — a quick, glanceable "how close am I to Create" in
// the titlebar, reading in the same lavender→pink progress vocabulary as the cards and the scrubbers.
const ReadyMeter = ({ done, total, t }: { done: number; total: number; t: TFunction<'builder'> }) => {
  if (total === 0) return null;

  return (
    <div className="mr-1 hidden items-center gap-2 md:flex">
      <div className="w-24">
        <GradientMeter
          progress={ratio01(done, total)}
          variant="bar"
          size={5}
          label={t('editor.ready', { done, total })}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
};

const EditorTopBar = ({
  template,
  phase,
  allComplete,
  done,
  total,
  saveStatus,
  lastSavedAt,
  onCreate,
  onExit,
  t,
}: {
  template: Template;
  phase: Phase;
  allComplete: boolean;
  done: number;
  total: number;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  onCreate: () => void;
  onExit: () => void;
  t: TFunction<'builder'>;
}) => (
  <header className="flex items-center gap-2.5 border-b border-foreground/10 bg-surface-2/70 px-4 py-2.5 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)] backdrop-blur-md sm:px-6">
    {/* Back affordance as a subtle pill — harmonized with the hub's "Change template" wording. */}
    <button
      type="button"
      onClick={() => {
        withViewTransition(onExit);
      }}
      className="tap inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 motion-reduce:transition-none"
    >
      <ChevronLeft size={16} />
      <span className="hidden sm:inline">{t('hub.changeTemplate')}</span>
    </button>

    <span aria-hidden="true" className="h-5 w-px shrink-0 bg-foreground/15" />

    {/* Project breadcrumb — a brand chip + the template name, reading as the thing being edited. */}
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/20"
    >
      <Clapperboard className="size-4" />
    </span>
    {/* Template name as a kinetic heading — the words rise in on open, the signature editorial
        entrance; the shared `studio-title` view-transition name rides the wrapper for the gallery→
        editor morph. Clipped horizontally so long names never wrap the compact titlebar — use
        `overflow-x-clip`, not `-hidden`, so it doesn't force overflow-y to `auto` and crop descenders. */}
    <span style={{ viewTransitionName: 'studio-title' }} className="min-w-0 flex-1 overflow-x-clip">
      <KineticHeading text={template.name} level="s" as="span" className="flex-nowrap whitespace-nowrap" />
    </span>

    {phase === 'edit' && <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />}
    {phase === 'edit' && <ReadyMeter done={done} total={total} t={t} />}
    {phase === 'edit' && (
      <PressableScale
        onClick={onCreate}
        disabled={!allComplete}
        hoverLift
        haptic="success"
        className="brand-gradient group inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-900/30 transition-shadow hover:shadow-brand-500/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
      >
        <Sparkles size={16} /> {t('hub.createCta')}
      </PressableScale>
    )}
  </header>
);

interface ToolPanelProps extends EditorShellProps {
  tool: Tool;
  section: InputSection | null;
}

// The contextual panel for the active rail tool.
const ToolPanel = (p: ToolPanelProps) => {
  if (p.tool === 'media') {
    return (
      <MediaToolPanel
        template={p.template}
        model={p.model}
        onMusicChange={p.onMusicChange}
        onBackgroundChange={p.onBackgroundChange}
      />
    );
  }

  if (p.tool === 'format') return <FormatPanel template={p.template} />;

  if (!p.section) return null;

  return (
    <ScenePanel
      template={p.template}
      section={p.section}
      model={p.model}
      clipCount={p.clipCount}
      onFormDataChange={p.onFormDataChange}
      onClipChange={p.onClipChange}
      onAddRush={p.onAddRush}
      onSelectRush={p.onSelectRush}
      onRemoveRush={p.onRemoveRush}
      onEditChange={p.onEditChange}
    />
  );
};

interface EditorBodyProps extends EditorShellProps {
  sections: InputSection[];
  tool: Tool;
  setTool: (tool: Tool) => void;
  section: InputSection | null;
  onSelectScene: (name: string) => void;
  panelTitle: string | null;
  panelEyebrow: string | null;
  rail: RailItem[];
  t: TFunction<'builder'>;
}

interface ProgramAreaProps {
  clipFile: File | undefined;
  section: InputSection | null;
  editForClip: VideoEdit | undefined;
  onEditChange: EditorShellProps['onEditChange'];
  template: Template;
  model: SceneModel;
  t: TFunction<'builder'>;
}

// Right column: template preview by default; toggle to trim/crop editor when a clip is present.
const ProgramArea = ({ clipFile, section, editForClip, onEditChange, template, model, t }: ProgramAreaProps) => {
  const [editMode, setEditMode] = useState(false);

  // Reset to preview whenever the active section changes or the clip is removed.
  useEffect(() => {
    setEditMode(false);
  }, [section?.name, clipFile]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {clipFile && section && (
        <div className="flex shrink-0 items-center justify-center border-b border-foreground/10 px-3 py-2">
          <SegmentedControl
            ariaLabel={t('editor.viewMode')}
            value={editMode ? 'edit' : 'preview'}
            onChange={(value) => {
              setEditMode(value === 'edit');
            }}
            options={[
              {
                value: 'preview',
                ariaLabel: t('editor.preview'),
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5" />
                    {t('editor.preview')}
                  </span>
                ),
              },
              {
                value: 'edit',
                ariaLabel: t('stepClip.editorLabel'),
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5" />
                    {t('stepClip.editorLabel')}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {editMode && clipFile && section ? (
          <div className="h-full overflow-y-auto p-4">
            <TimelineEditor
              file={clipFile}
              label={t('stepClip.editorLabel')}
              edit={editForClip}
              onChange={(edit) => {
                onEditChange(section.name, edit);
              }}
            />
          </div>
        ) : (
          <ProgramMonitor
            label={t('editor.preview')}
            note={t('editor.approx')}
            meta={orientationOf(template)}
            swapKey={section?.name}
          >
            <SectionPreview template={template} section={section} model={model} />
          </ProgramMonitor>
        )}
      </div>
    </div>
  );
};

// The three-pane edit surface: tool dock · contextual panel · program monitor, with the scene
// timeline lane below.
const EditorBody = (p: EditorBodyProps) => {
  const clipFile =
    p.tool === 'content' && p.section?.kind === 'clip' ? p.model.clipsBySection[p.section.name] : undefined;
  const editForClip = p.section ? p.model.editsBySection[p.section.name] : undefined;
  const { containerRef, monitorHeight, beginResize, resizeBy } = useMobileSplit();

  return (
    // One grid holds all regions. Mobile (flex-col): monitor → resize divider → panel → timeline →
    // dock (the dock is a bottom tab bar, order-last). The monitor's height is the draggable mobile
    // split (`--monitor-h`); `md:h-auto` resets it for the grid tiers, where the timeline spans the
    // full second row below dock·panel·monitor. Same tiers as ShellChrome: icon-only dock + narrow
    // panel at md, widening at lg/xl so the monitor keeps priority.
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[3.75rem_19rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[5rem_22rem_minmax(0,1fr)] xl:grid-cols-[5rem_24rem_minmax(0,1fr)]"
    >
      <ToolDock
        items={p.rail.map((r): ToolItem<Tool> => ({ id: r.tool, icon: r.icon, label: r.label }))}
        active={p.tool}
        onSelect={p.setTool}
        ariaLabel={p.t('editor.tools')}
      />

      <section className="order-3 flex min-h-0 flex-1 flex-col overflow-hidden border-foreground/10 bg-surface/30 md:order-none md:border-r">
        {p.panelTitle && (
          <header className="shrink-0 border-b border-foreground/10 px-4 py-3 sm:px-5">
            {p.panelEyebrow && (
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-brand-600/70 dark:text-brand-300/60">
                {p.panelEyebrow}
              </p>
            )}
            <h2 className="font-display text-lg font-bold text-foreground">{p.panelTitle}</h2>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Keyed by tool + scene so swapping either cross-fades the body instead of hard-cutting. */}
          <div key={`${p.tool}:${p.section?.name ?? ''}`} className="panel-swap motion-reduce:animate-none">
            <ToolPanel {...p} />
          </div>
        </div>
      </section>

      <div
        className="order-1 h-[var(--monitor-h)] min-h-0 shrink-0 md:order-none md:h-auto md:shrink"
        style={{ '--monitor-h': monitorHeight } as CSSProperties}
      >
        <ProgramArea
          clipFile={clipFile}
          section={p.section}
          editForClip={editForClip}
          onEditChange={p.onEditChange}
          template={p.template}
          model={p.model}
          t={p.t}
        />
      </div>

      <MobileResizeHandle onResize={beginResize} onNudge={resizeBy} label={p.t('editor.resizePanels')} />

      <footer className="track-lane order-4 flex items-stretch border-t border-foreground/10 md:order-none md:col-span-3">
        <div className="hidden w-20 shrink-0 flex-col items-center justify-center gap-1.5 border-r border-foreground/10 bg-surface-2/30 sm:flex">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-brand-500/12 text-brand-500 ring-1 ring-brand-500/20"
          >
            <Layers size={17} />
          </span>
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {p.t('editor.timeline')}
          </span>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500/15 px-1.5 text-[0.62rem] font-bold tabular-nums text-brand-600 ring-1 ring-brand-500/20 dark:text-brand-300">
            {p.sections.length}
          </span>
        </div>
        <SceneFilmstrip
          template={p.template}
          sections={p.sections}
          model={p.model}
          showMedia={p.showMedia}
          activeName={p.section?.name ?? null}
          onSelect={p.onSelectScene}
        />
      </footer>
    </div>
  );
};

// Fullscreen, app-style montage studio: an app titlebar over a dock · panel · program-monitor surface
// with a scene timeline below. One shell hosts editing, the compile, and the result (the latter two
// render `phaseContent` in-body).
export const EditorShell = (p: EditorShellProps) => {
  const { template, model, showMedia, phase } = p;
  const { t, i18n } = useTranslation('builder');
  useLockBodyScroll();

  const sections = templateService.orderedInputSections(template.descriptor);
  const [tool, setTool] = useState<Tool>('content');
  const [sceneName, setSceneName] = useState<string | null>(() => {
    const { nextSectionIndex } = nextCue(sections, template, model, showMedia);

    return sections[nextSectionIndex >= 0 ? nextSectionIndex : 0]?.name ?? null;
  });

  const section: InputSection | null = sections.find((s) => s.name === sceneName) ?? sections.at(0) ?? null;
  const { doneItems, totalItems } = hubProgress(sections, template, model, showMedia);

  const onSelectScene = (name: string) => {
    setSceneName(name);
    setTool('content');
  };

  const rail: RailItem[] = [
    { tool: 'content', icon: Film, label: t('editor.content') },
    ...(showMedia ? [{ tool: 'media' as const, icon: Music, label: t('editor.media') }] : []),
    { tool: 'format', icon: Proportions, label: t('editor.format') },
  ];

  // Per-item framing: when editing content, the panel header shows the section's kind (Record/Details)
  // as an eyebrow above its title, instead of an umbrella word.
  const onContent = tool === 'content';
  const sceneTitle = section && (resolveTranslation(section.title, i18n.language) ?? t('hub.section'));
  const panelTitle = onContent ? sceneTitle : t(`editor.${tool}`);
  const panelEyebrow = onContent && section ? t(sectionKindMeta(section).labelKey) : null;

  // Sit BELOW the global LeClap header (fixed, ~4rem, z-50) rather than covering it — the site header
  // stays visible and on top. The shell fills the rest of the viewport with its own toolbar + panels.
  return createPortal(
    <div className="dark fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-background text-foreground">
      <EditorTopBar
        template={template}
        phase={phase}
        allComplete={p.allComplete}
        done={doneItems}
        total={totalItems}
        saveStatus={p.saveStatus}
        lastSavedAt={p.lastSavedAt}
        onCreate={p.onCreate}
        onExit={p.onExit}
        t={t}
      />

      {phase === 'edit' ? (
        <EditorBody
          {...p}
          sections={sections}
          tool={tool}
          setTool={setTool}
          section={section}
          onSelectScene={onSelectScene}
          panelTitle={panelTitle}
          panelEyebrow={panelEyebrow}
          rail={rail}
          t={t}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-8">{p.phaseContent}</div>
        </div>
      )}
    </div>,
    document.body
  );
};
