import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '@/presentation/components/icons';
import {
  SECTION_CATEGORY,
  SECTION_ICON,
  SECTION_KINDS,
  type SectionCategory,
  type SectionKind,
} from '@/lib/sectionMeta';
import { SECTION_LABELS } from '../templateEditorModel';

interface AddSceneMenuProps {
  onAdd: (kind: SectionKind) => void;
}

const CATEGORY_ORDER: readonly SectionCategory[] = ['clip', 'input', 'data'];

// The timeline's "Add scene" affordance: a dashed tile that opens a compact kind picker so the author
// chooses what kind of scene to insert (video / form / color / music / image / partial) instead of
// always getting a video. Closes on outside-click or Escape; selecting a kind delegates to `onAdd`.
export const AddSceneMenu = ({ onAdd }: AddSceneMenuProps) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (kind: SectionKind): void => {
    setOpen(false);
    onAdd(kind);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="tap grid h-full w-32 place-items-center gap-1.5 rounded-xl border border-dashed border-foreground/20 bg-surface/30 p-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-brand-500/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-foreground/[0.06]">
          <Plus className="size-[1.15rem]" />
        </span>
        {t('shell.addScene')}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('shell.addScene')}
          className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-foreground/10 bg-surface-2 p-1.5 shadow-xl"
        >
          {CATEGORY_ORDER.map((category) => {
            const kinds = SECTION_KINDS.filter((kind) => SECTION_CATEGORY[kind] === category);

            return kinds.map((kind) => {
              const Icon = SECTION_ICON[kind];

              return (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    pick(kind);
                  }}
                  className="tap flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-500/10">
                    <Icon className="size-4 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  </span>
                  {SECTION_LABELS[kind]}
                </button>
              );
            });
          })}
        </div>
      )}
    </div>
  );
};
