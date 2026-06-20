import { useTranslation } from 'react-i18next';
import { OverlayCanvas } from '../OverlayCanvas';
import { PreviewSurface } from '../editor/PreviewSurface';
import { newBaseLayer } from '../editor/layerGeometry';
import { findBackground, BACKGROUND_LIBRARY } from '@/data/mediaCatalog';
import {
  collectVariables,
  SECTION_LABELS,
  type BackgroundLayer,
  type EditorSection,
  type EditorState,
  type TextOverlay,
} from '../templateEditorModel';

// The picture an image_background section will show: its first allowed background, else any bundled one.
const imageSectionUrl = (allowed: string[]): string | undefined =>
  findBackground(allowed.at(0) ?? '')?.url ?? BACKGROUND_LIBRARY.at(0)?.url;

// A color section's layer stack to edit on the canvas: its authored layers, or a single base layer
// synthesized from the picked colour when none have been added yet.
const colorLayers = (section: Extract<EditorSection, { kind: 'color' }>): BackgroundLayer[] =>
  section.layers && section.layers.length > 0 ? section.layers : [newBaseLayer(section.color)];

// Sections whose preview is the WYSIWYG overlay canvas (a real backdrop + draggable text overlays).
const hasOverlayCanvas = (
  section: EditorSection
): section is Extract<EditorSection, { kind: 'video' | 'color' | 'image' }> =>
  section.kind === 'video' || section.kind === 'color' || section.kind === 'image';

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

// A labelled, painted frame for the non-visual section kinds (music / form / partial) — they have no
// backdrop or text overlays to edit, so the monitor just names them.
const FallbackPreview = ({ section }: { section: EditorSection }) => (
  <div className="grid h-full place-items-center p-4">
    <div className="relative w-full max-w-md">
      <PreviewSurface className="aspect-video w-full" />
      <span className="absolute inset-x-0 bottom-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
        {SECTION_LABELS[section.kind]}
      </span>
    </div>
  </div>
);

// The selected section's editable preview, rendered inside ProgramMonitor's children slot. A thin
// dispatcher: no section → empty state; visual sections → the centered WYSIWYG OverlayCanvas (real
// backdrop + draggable text overlays) wired back through patchSection; other kinds → a labelled frame.
export const EditorMonitor = ({ state, section, onPatchSection }: EditorMonitorProps) => {
  const { t } = useTranslation('admin');

  if (!section) return <EmptyState label={t('shell.monitorEmpty')} />;

  if (!hasOverlayCanvas(section)) return <FallbackPreview section={section} />;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl">
        <OverlayCanvas
          overlays={section.overlays}
          orientation={state.orientation}
          variables={collectVariables(state)}
          background={section.kind === 'image' ? { imageUrl: imageSectionUrl(section.allowed) } : undefined}
          layers={
            section.kind === 'color'
              ? {
                  items: colorLayers(section),
                  onChange: (layers) => {
                    onPatchSection({ layers });
                  },
                }
              : undefined
          }
          onChange={(overlays: TextOverlay[]) => {
            onPatchSection({ overlays });
          }}
        />
      </div>
    </div>
  );
};
