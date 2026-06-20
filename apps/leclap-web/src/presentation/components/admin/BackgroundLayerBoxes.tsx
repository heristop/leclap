// Direct-manipulation boxes for a color section's background layers, rendered inside the OverlayCanvas
// frame behind the text overlays. The base layer (index 0) is a full-bleed, non-interactive backdrop;
// every extra layer is a draggable + resizable box that writes its new x/y/w/h back to the descriptor.
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { BackgroundLayer } from './templateEditorModel';
import { cssLayerBackground, layerFill } from './editor/layerPreview';
import { layerPercents, movedGeometry, resizedGeometry } from './editor/layerDrag';

// 2% keyboard nudge for a selected layer box.
const NUDGE = 2;

const NUDGE_OFFSETS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE],
};

interface BackgroundLayerBoxesProps {
  layers: BackgroundLayer[];
  onChange: (layers: BackgroundLayer[]) => void;
  frameRect: () => DOMRect | undefined;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export const BackgroundLayerBoxes = ({
  layers,
  onChange,
  frameRect,
  selectedIndex,
  onSelect,
}: BackgroundLayerBoxesProps) => {
  const { t } = useTranslation('admin');

  const patch = (index: number, p: Partial<BackgroundLayer>) => {
    onChange(layers.map((layer, i) => (i === index ? { ...layer, ...p } : layer)));
  };

  return (
    <>
      {layers.map((layer, index) => {
        if (index === 0) {
          return (
            <div key={index} aria-hidden className="pointer-events-none" style={cssLayerBackground(layer, true)} />
          );
        }

        return (
          <LayerBox
            key={index}
            layer={layer}
            index={index}
            t={t}
            active={index === selectedIndex}
            frameRect={frameRect}
            onSelect={onSelect}
            onPatch={(p) => {
              patch(index, p);
            }}
          />
        );
      })}
    </>
  );
};

interface LayerBoxProps {
  layer: BackgroundLayer;
  index: number;
  t: TFunction<'admin'>;
  active: boolean;
  frameRect: () => DOMRect | undefined;
  onSelect: (index: number) => void;
  onPatch: (patch: Partial<BackgroundLayer>) => void;
}

// One extra layer's box: a faded fill (at the layer's opacity) under a full-opacity selection ring and
// resize handle, so the editing affordances stay crisp over a semi-transparent layer.
const LayerBox = ({ layer, index, t, active, frameRect, onSelect, onPatch }: LayerBoxProps) => {
  const modeRef = useRef<'move' | 'resize' | null>(null);
  const grabRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const geo = layerPercents(layer);

  const pointerPercent = (e: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const rect = frameRect();

    if (!rect) return null;

    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
  };

  const onBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect(index);
    const p = pointerPercent(e);

    if (!p) return;
    grabRef.current = { dx: p.x - geo.x, dy: p.y - geo.y };
    modeRef.current = 'move';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (modeRef.current === null) return;
    e.stopPropagation();
    const p = pointerPercent(e);

    if (!p) return;

    if (modeRef.current === 'resize') {
      onPatch(resizedGeometry(geo.x, geo.y, p.x, p.y));

      return;
    }
    onPatch(movedGeometry(p.x - grabRef.current.dx, p.y - grabRef.current.dy, geo.w, geo.h));
  };

  const endGesture = (e: ReactPointerEvent<HTMLDivElement>) => {
    modeRef.current = null;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect(index);
    modeRef.current = 'resize';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const offset = NUDGE_OFFSETS[e.key];

    if (!offset) return;
    e.preventDefault();
    onPatch(movedGeometry(geo.x + offset[0], geo.y + offset[1], geo.w, geo.h));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('layer.name', { index })}
      aria-pressed={active}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={onKeyDown}
      style={{ left: `${geo.x}%`, top: `${geo.y}%`, width: `${geo.w}%`, height: `${geo.h}%` }}
      className={cn('absolute cursor-move touch-none rounded-[0.15em] outline-none', active && 'ring-2 ring-brand-500')}
    >
      <div aria-hidden className="absolute inset-0 rounded-[0.15em]" style={layerFill(layer)} />
      {active && (
        <div
          aria-hidden
          onPointerDown={onHandlePointerDown}
          className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-brand-500 bg-surface shadow"
        />
      )}
    </div>
  );
};
