// The unified "+ Add" menu for the editor's left panel: a trigger button that opens a popover of the
// element kinds the selected section actually supports (gated by `canAddElement`). Picking an item
// closes the menu and emits its kind to the parent, which appends the element. Sections that own no
// addable elements (music/form/partial) render nothing. The popover interaction mirrors
// overlayControls' VariableMenu (outside-click + Escape).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Plus, Sparkles, Square, Type, type LucideIcon } from '@/presentation/components/icons';
import { Button } from '@/presentation/components/ui';
import type { EditorSection } from '../templateEditorModel';
import { canAddElement } from './sectionElements';
import type { ElementRef } from './useSectionSelection';

type AddableKind = ElementRef['kind'];

// Canonical add order: background layer → text → image overlay → animation.
const ADD_ORDER: ReadonlyArray<AddableKind> = ['layer', 'text', 'image', 'animation'];

// The element kinds the section supports, in canonical order. Empty for sections with no elements.
export function addableKinds(section: EditorSection): AddableKind[] {
  return ADD_ORDER.filter((kind) => canAddElement(section, kind));
}

// Icon + i18n label-key per addable kind.
const KIND_ICON: Record<AddableKind, LucideIcon> = {
  layer: Square,
  text: Type,
  image: Image,
  animation: Sparkles,
};

const KIND_LABEL: Record<AddableKind, string> = {
  layer: 'element.addBackgroundColor',
  text: 'element.addText',
  image: 'element.addImageOverlay',
  animation: 'element.addAnimation',
};

interface AddElementMenuProps {
  section: EditorSection;
  onAdd: (kind: AddableKind) => void;
}

export const AddElementMenu = ({ section, onAdd }: AddElementMenuProps) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const kinds = addableKinds(section);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;

      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', onPointer);
      document.addEventListener('keydown', onKey);
    }

    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (kinds.length === 0) return null;

  const pick = (kind: AddableKind) => {
    onAdd(kind);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('element.add')}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <Plus className="h-3.5 w-3.5" /> {t('element.add')}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute z-10 mt-1 min-w-[12rem] overflow-auto rounded-xl border border-divider bg-surface p-1 shadow-[var(--shadow-lg)]"
        >
          {kinds.map((kind) => {
            const Icon = KIND_ICON[kind];

            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  pick(kind);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-brand-500/15"
              >
                <Icon className="h-3.5 w-3.5 text-gray-400" /> {t(KIND_LABEL[kind])}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
