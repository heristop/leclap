// One scene rendered for PLAYBACK inside the live program monitor: the same backdrop, look/grade
// filter, text sugar and overlay typography as the edit canvas (single-sourced via layerPreview /
// SugarPreviewLayer / boxStyle) — but display-only (the whole tree is pointer-events-none) and with
// each text overlay wrapped in an animation div the rAF clock mutates directly (reveal/exit,
// Ken Burns). Still-image and animation overlays are out of the v1 playback scope; they keep
// rendering in the edit canvas.
import { forwardRef, useImperativeHandle, useRef, type CSSProperties, type RefObject } from 'react';
import { displayFromTokens } from '@/lib/variableSyntax';
import { findBackground, BACKGROUND_LIBRARY } from '@/data/mediaCatalog';
import {
  type BackgroundLayer,
  type EditorSection,
  type Orientation,
  type TextOverlay,
} from '../templateEditorModel';
import { newBaseLayer } from '../editor/layerGeometry';
import { cssLayerBackground } from '../editor/layerPreview';
import { lookFilter, gradeFilter } from '../editor/lookFilters';
import { boxStyle } from './sectionCanvasBox';
import { SugarPreviewLayer } from './SugarPreviewLayer';
import { initialSectionSelection } from './useSectionSelection';

export type VisualSection = Extract<EditorSection, { kind: 'video' | 'color' | 'image' }>;

// The handles the player's paint loop writes to every frame — raw DOM, never React state.
export interface ProgramSceneHandles {
  backdrop: HTMLDivElement | null;
  overlays: Array<HTMLDivElement | null>;
}

// The picture an image_background section will show (same rule as EditorMonitor): first allowed
// library background, else any bundled one.
const imageSectionUrl = (allowed: string[]): string | undefined =>
  findBackground(allowed.at(0) ?? '')?.url ?? BACKGROUND_LIBRARY.at(0)?.url;

// A color section's layer stack (same rule as EditorMonitor): authored layers, else a single base
// layer synthesized from the picked colour.
const colorLayers = (section: Extract<EditorSection, { kind: 'color' }>): BackgroundLayer[] =>
  section.layers && section.layers.length > 0 ? section.layers : [newBaseLayer(section.color)];

// The engine grades the base frame BEFORE sugar and drawtext overlays, so only the backdrop group
// carries the CSS look/grade filter (mirrors SectionCanvas).
const backdropFilter = (section: VisualSection): CSSProperties => {
  const parts = [lookFilter(section.look), gradeFilter(section.grade)].filter((part) => part !== 'none');

  return parts.length > 0 ? { filter: parts.join(' ') } : {};
};

const Backdrop = ({ section }: { section: VisualSection }) => {
  if (section.kind === 'image') {
    const url = imageSectionUrl(section.allowed);

    if (!url) return null;

    return <img aria-hidden alt="" src={url} className="absolute inset-0 h-full w-full object-cover" />;
  }

  if (section.kind === 'color') {
    return (
      <>
        {colorLayers(section).map((layer, i) => (
          <div key={i} aria-hidden style={cssLayerBackground(layer, i === 0)} />
        ))}
      </>
    );
  }

  // A video scene has no asset at authoring time — the same dark placeholder frame as the canvas.
  return (
    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,#2b2b3a,#15151f)]" />
  );
};

interface ProgramSceneProps {
  section: VisualSection;
  orientation: Orientation;
  frameRef: RefObject<HTMLDivElement | null>;
  previewH: number;
}

// Renders one scene; exposes the backdrop + per-overlay wrapper elements for the clock's paint loop.
export const ProgramScene = forwardRef<ProgramSceneHandles, ProgramSceneProps>(
  ({ section, orientation, frameRef, previewH }, ref) => {
    const backdropRef = useRef<HTMLDivElement>(null);
    const overlayRefs = useRef<Array<HTMLDivElement | null>>([]);
    const overlays: TextOverlay[] = section.overlays;
    overlayRefs.current.length = overlays.length;

    useImperativeHandle(ref, () => ({
      get backdrop() {
        return backdropRef.current;
      },
      get overlays() {
        return overlayRefs.current;
      },
    }));

    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Backdrop group: graded + Ken Burns'd as one unit (transform written by the clock). */}
        <div ref={backdropRef} className="absolute inset-0" style={backdropFilter(section)}>
          <Backdrop section={section} />
        </div>
        <SugarPreviewLayer
          caption={section.caption}
          titleCard={section.kind === 'color' ? section.titleCard : undefined}
          lowerThird={section.kind === 'video' ? section.lowerThird : undefined}
          orientation={orientation}
          frameRef={frameRef}
          selection={initialSectionSelection}
          onSelectElement={() => {}}
        />
        {overlays.map((overlay, index) => (
          <div
            key={index}
            ref={(el) => {
              overlayRefs.current[index] = el;
            }}
            className="absolute inset-0"
          >
            <span className="absolute whitespace-pre" style={boxStyle(overlay, previewH, orientation)}>
              {displayFromTokens(overlay.text)}
            </span>
          </div>
        ))}
      </div>
    );
  }
);
ProgramScene.displayName = 'ProgramScene';
