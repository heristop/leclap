// Pure key-matching for the studio editor's global shortcuts. Kept DOM-free so it is fully unit
// tested; the React hook (useEditorShortcuts) owns attach/detach and dispatch. `mod` is meta-or-ctrl
// so the same table serves darwin (⌘) and everywhere else (Ctrl).

export type EditorShortcutAction =
  | 'undo'
  | 'redo'
  | 'save'
  | 'delete-scene'
  | 'duplicate-scene'
  | 'next-scene'
  | 'prev-scene'
  | 'add-scene'
  | 'toggle-play'
  | 'next-tool'
  | 'prev-tool'
  | 'show-help'
  | 'dismiss-help';

// Minimal event shape so tests never touch the DOM (a real KeyboardEvent satisfies it structurally).
export interface KeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface TargetLike {
  tagName: string;
  isContentEditable: boolean;
}

// Actions safe (and desirable) to fire even while a text field is focused. Bare-key actions that would
// steal typing (space, arrows, letters, delete) are deliberately excluded.
export const ALWAYS_ALLOW_IN_INPUTS: ReadonlySet<EditorShortcutAction> = new Set<EditorShortcutAction>([
  'undo',
  'redo',
  'save',
  'show-help',
  'dismiss-help',
]);

export function resolveShortcut(e: KeyEventLike): EditorShortcutAction | null {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();

  if (mod && !e.altKey) {
    if (k === 'z') return e.shiftKey ? 'redo' : 'undo';

    if (k === 'y') return 'redo';

    if (k === 's') return 'save';

    if (k === 'd') return 'duplicate-scene';

    return null;
  }

  // From here on, no meta/ctrl — bare (optionally shifted) keys.
  if (mod) return null;

  if (e.key === '?') return 'show-help';

  if (e.key === 'Escape') return 'dismiss-help';

  if (e.key === 'Backspace' || e.key === 'Delete') return 'delete-scene';

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return 'next-scene';

  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return 'prev-scene';

  if (e.key === ' ') return 'toggle-play';

  if (e.key === ']') return 'next-tool';

  if (e.key === '[') return 'prev-tool';

  if (k === 'n') return 'add-scene';

  return null;
}

export function isTypingTarget(t: TargetLike | null): boolean {
  if (!t) return false;

  if (t.isContentEditable) return true;

  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}
