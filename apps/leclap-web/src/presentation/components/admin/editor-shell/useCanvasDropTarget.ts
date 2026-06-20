// The DOM-facing half of canvas drag-and-drop: it turns native DragEvents on the frame into a
// validated DropPayload + a 0..1 frame fraction, then hands them to onCanvasDrop. The pure resolution
// of that payload into a section patch lives in canvasDrop.ts; this hook only does the DOM plumbing
// (accept-guard, dropEffect, drag-over highlight, fraction math). Kept out of SectionCanvas so that
// component stays within the statement budget.
import { useState, type DragEvent } from 'react';
import { CANVAS_DND_MIME, parseDropPayload, type DropPayload, type DropPoint } from './canvasDrop';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Parse a dataTransfer string, returning null instead of throwing on malformed JSON.
const safeParse = (raw: string): unknown => {
  if (raw === '') return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface DropTargetArgs {
  frameRect: () => DOMRect | undefined;
  onCanvasDrop?: (payload: DropPayload, point: DropPoint) => void;
}

export interface CanvasDropHandlers {
  dragOver: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

export const useCanvasDropTarget = ({ frameRect, onCanvasDrop }: DropTargetArgs): CanvasDropHandlers => {
  const [dragOver, setDragOver] = useState(false);

  const accepts = (e: DragEvent): boolean => Boolean(onCanvasDrop) && e.dataTransfer.types.includes(CANVAS_DND_MIME);

  const onDragOver = (e: DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const onDrop = (e: DragEvent) => {
    setDragOver(false);

    if (!accepts(e)) return;
    e.preventDefault();
    const payload = parseDropPayload(safeParse(e.dataTransfer.getData(CANVAS_DND_MIME)));
    const rect = frameRect();

    if (!payload || !rect) return;
    const fracX = clamp01((e.clientX - rect.left) / rect.width);
    const fracY = clamp01((e.clientY - rect.top) / rect.height);
    onCanvasDrop?.(payload, { fracX, fracY });
  };

  return {
    dragOver,
    onDragOver,
    onDragLeave: () => {
      setDragOver(false);
    },
    onDrop,
  };
};
