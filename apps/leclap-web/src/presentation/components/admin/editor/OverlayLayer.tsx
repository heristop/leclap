// Shared chrome for one overlay (image or animation) inside its list editor: a compact header — an
// index badge, the layer label, and a remove control — above the picker/placement content. Deliberately
// flat (no card border of its own) so the inner MediaPicker / AnimationGallery is the only framing;
// consecutive layers are separated by a hairline rule, not stacked boxes. Shared by ImageOverlayField
// and AnimationOverlayField.
import type { ReactNode } from 'react';
import { Trash2 } from '@/presentation/components/icons';

interface OverlayLayerProps {
  index: number;
  label: string;
  removeLabel: string;
  onRemove: () => void;
  children: ReactNode;
}

export const OverlayLayer = ({ index, label, removeLabel, onRemove, children }: OverlayLayerProps) => (
  <section className="border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
    <header className="mb-2 flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
        <span className="grid size-5 place-items-center rounded-full bg-brand-500/10 text-[0.65rem] font-bold text-brand-600 dark:text-brand-300">
          {index + 1}
        </span>
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
        aria-label={removeLabel}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </header>
    {children}
  </section>
);
