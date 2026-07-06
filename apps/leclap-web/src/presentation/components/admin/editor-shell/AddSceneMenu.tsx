import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { PressableScale } from '@/presentation/components/kinetic';
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
  // When given, only these kinds are offered (e.g. partials restrict to video/form/color/image).
  kinds?: readonly SectionKind[];
}

const CATEGORY_ORDER: readonly SectionCategory[] = ['clip', 'input', 'data'];
const MENU_WIDTH = 224; // px (w-56)

// The timeline's "Add scene" affordance: a dashed tile that opens a compact kind picker so the author
// chooses what kind of scene to insert (video / form / color / music / image / partial) instead of
// always getting a video. The menu is portalled to <body> and fixed-positioned above the button so the
// timeline's horizontal scroll container can't clip it. Closes on outside-click or Escape.
export const AddSceneMenu = ({ onAdd, kinds }: AddSceneMenuProps) => {
  const { t } = useTranslation('admin');
  const allowed = kinds ?? SECTION_KINDS;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { ref: plusRef, hoverProps: plusHoverProps } = useIconHover();

  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;

      if (buttonRef.current?.contains(target)) return;

      if (!menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;

      setOpen(false);
      // Standard menu behavior: Escape hands focus back to the trigger.
      buttonRef.current?.focus();
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

  // Menu keyboard support: focus lands on the first item when the menu opens…
  useEffect(() => {
    if (!open) return;

    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  // …and ↑/↓ cycle through the items (wrapping at both ends).
  const onMenuKeyDown = (e: ReactKeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    e.preventDefault();

    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

    if (items.length === 0) return;

    const at = items.indexOf(document.activeElement as HTMLElement);

    // Focus sitting outside the items (shouldn't happen after the open-autofocus) re-enters at the top.
    if (at === -1) {
      items[0]?.focus();

      return;
    }

    const delta = e.key === 'ArrowDown' ? 1 : -1;
    items[(at + delta + items.length) % items.length]?.focus();
  };

  const toggle = (): void => {
    if (open) {
      setOpen(false);

      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();

    if (rect) {
      setAnchor({
        left: Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8),
        bottom: window.innerHeight - rect.top + 8,
      });
    }

    setOpen(true);
  };

  const pick = (kind: SectionKind): void => {
    setOpen(false);
    onAdd(kind);
  };

  return (
    <div className="shrink-0">
      <PressableScale
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="grid h-full w-32 place-items-center gap-1.5 rounded-xl border border-dashed border-foreground/20 bg-surface/30 p-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-brand-500/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        {...plusHoverProps}
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-foreground/[0.06]">
          <PlusIcon ref={plusRef} size={18} />
        </span>
        {t('shell.addScene')}
      </PressableScale>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={t('shell.addScene')}
            onKeyDown={onMenuKeyDown}
            style={{ position: 'fixed', left: anchor.left, bottom: anchor.bottom }}
            className="dark z-[70] max-h-[60vh] w-56 overflow-y-auto rounded-xl border border-foreground/10 bg-surface-2 p-1.5 text-foreground shadow-2xl"
          >
            {CATEGORY_ORDER.flatMap((category) =>
              allowed
                .filter((kind) => SECTION_CATEGORY[kind] === category)
                .map((kind) => {
                  const Icon = SECTION_ICON[kind];

                  return (
                    <PressableScale
                      key={kind}
                      role="menuitem"
                      onClick={() => {
                        pick(kind);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-500/10">
                        <Icon className="size-4 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                      </span>
                      {SECTION_LABELS[kind]}
                    </PressableScale>
                  );
                })
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
