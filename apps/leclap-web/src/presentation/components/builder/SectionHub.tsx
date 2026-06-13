import { useState } from 'react';
import { FileText, Video, Music, CheckCircle2, Circle, Pencil, Sparkles } from 'lucide-react';
import { Button, Card } from '@/presentation/components/ui';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/presentation/components/ui/dialog';
import { StepForm } from '@/presentation/components/builder/StepForm';
import { StepClip } from '@/presentation/components/builder/StepClip';
import { MediaPicker } from '@/presentation/components/admin/MediaPicker';
import { templateService, type Template, type InputSection } from '@/services/templateService';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
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
  title: string;
  subtitle?: string;
  done: boolean;
  onOpen: () => void;
}

// One tappable section row: icon, title/subtitle, completion tick and an "edit" affordance.
const HubRow = ({ icon: Icon, title, subtitle, done, onOpen }: HubRowProps) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      'group flex w-full items-center gap-4 rounded-2xl border p-4 text-left min-h-[4rem]',
      'bg-foreground/5 border-foreground/10 transition-colors duration-200 motion-reduce:transition-none',
      'hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      done && 'border-success/30'
    )}
  >
    <span
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors duration-200 motion-reduce:transition-none',
        done ? 'bg-success/15 text-success-foreground' : 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold text-foreground">{title}</span>
      {subtitle && <span className="block truncate text-sm text-gray-400">{subtitle}</span>}
    </span>
    <span className="flex shrink-0 items-center gap-3">
      <span className="hidden items-center gap-1.5 text-xs font-medium text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none sm:flex">
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </span>
      {done ? (
        <CheckCircle2 className="h-6 w-6 text-success-foreground" />
      ) : (
        <Circle className="h-6 w-6 text-gray-500" />
      )}
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
      <MediaPanel template={template} model={model} onMusic={p.onMusicChange} onBackground={p.onBackgroundChange} />
    );
  }

  const { section } = panel;

  if (section.kind === 'form') {
    return (
      <StepForm
        template={template}
        section={{ name: section.name, title: section.title }}
        formData={model.formData}
        onFormDataChange={p.onFormDataChange}
      />
    );
  }

  const descriptorSection = (template.descriptor.sections ?? []).find((s) => s.name === section.name);

  if (!descriptorSection) return null;

  return (
    <StepClip
      section={descriptorSection}
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
}

// Music + background pickers shown inside the hub modal. Mirrors StepMedia, scoped for the panel.
const MediaPanel = ({ template, model, onMusic, onBackground }: MediaPanelProps) => {
  const g = template.descriptor.global ?? {};
  const showMusic = (g.allowedMusic?.length ?? 0) > 0 || Boolean(g.allowUploadMusic);
  const showBackground = (g.allowedBackgrounds?.length ?? 0) > 0 || Boolean(g.allowUploadBackground);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-1 font-display text-2xl font-bold text-foreground">Music &amp; Background</h2>
        <p className="text-sm text-gray-400">Choose the soundtrack and backdrop</p>
      </div>
      {showMusic && (
        <div>
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">Music</h3>
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
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">Background Image</h3>
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

// Substitute {{ name }} refs with their global-variable value so a row shows the real
// question ("Tea or Coffee?") instead of the raw template token.
const interpolate = (text: string, vars: Record<string, unknown> | undefined): string =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars?.[key];

    return typeof value === 'string' ? value : '';
  });

const clipSubtitle = (section: InputSection, clipCount: number, vars: Record<string, unknown> | undefined): string => {
  // A clip's description carries its prompt (e.g. the Konbini "Tea or Coffee?"); show it so the
  // recorder knows which question this answer is for. Falls back to the clip position.
  const question = section.description?.en?.trim();

  if (question) return interpolate(question, vars);

  if (clipCount > 1) return `Clip ${section.clipIndex + 1} of ${clipCount}`;

  return 'Record or upload your clip';
};

// Accessible heading for the focused-section dialog (Radix requires a DialogTitle).
const panelHeading = (panel: ActivePanel): string => {
  if (panel?.kind === 'media') return 'Music & background';

  if (panel?.kind === 'section') {
    return panel.section.title?.en ?? (panel.section.kind === 'clip' ? 'Record your clip' : 'Your details');
  }

  return 'Section';
};

export const SectionHub = (props: SectionHubProps) => {
  const { template, model, clipCount, showMediaRow, allComplete, onCreate } = props;
  const [panel, setPanel] = useState<ActivePanel>(null);
  const sections = templateService.orderedInputSections(template.descriptor);

  const mediaItems = showMediaRow ? 1 : 0;
  const mediaDone = showMediaRow && mediaComplete(model) ? 1 : 0;
  const totalItems = sections.length + mediaItems;
  const doneItems = sections.filter((s) => sectionComplete(template, s, model)).length + mediaDone;
  const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 100;

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <h2 className="mb-2 font-display text-4xl font-bold text-foreground">{template.name}</h2>
        <p className="text-lg text-gray-400">Fill in each part, then create your video</p>
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
            {doneItems} of {totalItems} {totalItems === 1 ? 'section' : 'sections'} completed
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section) => (
            <HubRow
              key={section.name}
              icon={section.kind === 'clip' ? Video : FileText}
              title={section.title?.en ?? (section.kind === 'clip' ? `Clip ${section.clipIndex + 1}` : 'Your details')}
              subtitle={
                section.kind === 'clip'
                  ? clipSubtitle(section, clipCount, template.descriptor.global?.variables)
                  : section.description?.en
              }
              done={sectionComplete(template, section, model)}
              onOpen={() => {
                setPanel({ kind: 'section', section });
              }}
            />
          ))}
          {showMediaRow && (
            <HubRow
              icon={Music}
              title="Music & Background"
              subtitle={mediaComplete(model) ? 'Selection saved' : 'Choose soundtrack and backdrop'}
              done={mediaComplete(model)}
              onOpen={() => {
                setPanel({ kind: 'media' });
              }}
            />
          )}
        </div>

        <Button
          variant="primary"
          onClick={onCreate}
          disabled={!allComplete}
          className="group w-full px-8 py-3.5 active:translate-y-0 active:scale-[0.98]"
        >
          <Sparkles className="h-5 w-5" />
          Create my video
        </Button>
      </Card>

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto glass-panel-dark">
          <DialogTitle className="sr-only">{panelHeading(panel)}</DialogTitle>
          <DialogDescription className="sr-only">
            Edit this part of your video, then close to continue.
          </DialogDescription>
          <PanelBody {...props} panel={panel} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
