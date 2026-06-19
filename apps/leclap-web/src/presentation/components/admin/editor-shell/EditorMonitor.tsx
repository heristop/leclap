import { useTranslation } from 'react-i18next';
import { OverlayCanvas } from '../OverlayCanvas';
import { PreviewSurface } from '../editor/PreviewSurface';
import {
  collectVariables,
  SECTION_LABELS,
  type EditorSection,
  type EditorState,
  type TextOverlay,
} from '../templateEditorModel';

interface EditorMonitorProps {
  state: EditorState;
  section: EditorSection | null;
  onPatchSection: (partial: Partial<EditorSection>) => void;
}

// A muted empty state, shown when no section is selected.
const EmptyState = ({ label }: { label: string }) => (
  <div className="grid h-full place-items-center p-6 text-center text-sm font-medium text-muted-foreground">
    {label}
  </div>
);

// A labelled best-effort preview for sections without editable text overlays (color/image/music/form/
// partial). Color sections paint their picked color; everything else gets a neutral painted frame with
// the section label — the live overlay editor for these kinds is refined in a later phase.
const FallbackPreview = ({ section }: { section: EditorSection }) => {
  const label = SECTION_LABELS[section.kind];

  if (section.kind === 'color') {
    return (
      <div className="grid h-full place-items-center p-4">
        <div
          className="aspect-video w-full max-w-md rounded-lg border border-foreground/10"
          style={{ backgroundColor: section.color }}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full place-items-center p-4">
      <div className="relative w-full max-w-md">
        <PreviewSurface className="aspect-video w-full" />
        <span className="absolute inset-x-0 bottom-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
          {label}
        </span>
      </div>
    </div>
  );
};

// The selected section's editable preview, rendered inside ProgramMonitor's children slot. A thin
// dispatcher: no section → empty state; sections that carry text overlays → the WYSIWYG OverlayCanvas
// wired back through patchSection; all other kinds → a labelled best-effort preview.
export const EditorMonitor = ({ state, section, onPatchSection }: EditorMonitorProps) => {
  const { t } = useTranslation('admin');

  if (!section) return <EmptyState label={t('shell.monitorEmpty')} />;

  if (section.kind === 'video') {
    return (
      <div className="h-full overflow-y-auto p-4">
        <OverlayCanvas
          overlays={section.overlays}
          orientation={state.orientation}
          variables={collectVariables(state)}
          onChange={(overlays: TextOverlay[]) => {
            onPatchSection({ overlays });
          }}
        />
      </div>
    );
  }

  return <FallbackPreview section={section} />;
};
