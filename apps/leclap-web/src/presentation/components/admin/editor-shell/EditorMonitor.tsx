import { useTranslation } from 'react-i18next';
import { SectionCanvas } from './SectionCanvas';
import { PartialPreview } from './PartialPreview';
import { resolveCanvasDrop, type DropPayload, type DropPoint } from './canvasDrop';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';
import { PreviewSurface } from '../editor/PreviewSurface';
import { newBaseLayer } from '../editor/layerGeometry';
import { findBackground, BACKGROUND_LIBRARY } from '@/data/mediaCatalog';
import {
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
  selection: SectionSelectionState;
  onSelectElement: (ref: ElementRef | null) => void;
  onBeginEdit: () => void;
  onEndEdit: () => void;
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
// dispatcher: no section → empty state; visual sections → the centered WYSIWYG SectionCanvas (real
// backdrop + draggable text overlays) wired back through patchSection; other kinds → a labelled frame.
// The center canvas is now the ONLY draggable surface — its text styling controls live in the left
// OverlayInspector, sharing this `selection`.
export const EditorMonitor = ({
  state,
  section,
  onPatchSection,
  selection,
  onSelectElement,
  onBeginEdit,
  onEndEdit,
}: EditorMonitorProps) => {
  const { t } = useTranslation('admin');

  if (!section) return <EmptyState label={t('shell.monitorEmpty')} />;

  if (section.kind === 'partial') return <PartialPreview section={section} />;

  if (!hasOverlayCanvas(section)) return <FallbackPreview section={section} />;

  const onCanvasDrop = (payload: DropPayload, point: DropPoint) => {
    const result = resolveCanvasDrop(section, selection, payload, point, state.orientation);

    if (!result) return;
    onPatchSection(result.patch);
    onSelectElement(result.selectRef);
  };

  return (
    <div className="grid h-full place-items-center overflow-auto p-4 sm:p-6">
      <SectionCanvas
        overlays={section.overlays}
        orientation={state.orientation}
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
        images={section.images}
        animations={section.animations}
        selection={selection}
        onSelectElement={onSelectElement}
        onBeginEdit={onBeginEdit}
        onEndEdit={onEndEdit}
        onChange={(overlays: TextOverlay[]) => {
          onPatchSection({ overlays });
        }}
        onChangeImages={(images) => {
          onPatchSection({ images });
        }}
        onChangeAnimations={(animations) => {
          onPatchSection({ animations });
        }}
        onCanvasDrop={onCanvasDrop}
      />
    </div>
  );
};
