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

// Bare (no meta/ctrl) keys that map straight to an action. Arrow/delete pairs share a target.
const BARE_KEY_ACTIONS: Record<string, EditorShortcutAction> = {
  '?': 'show-help',
  Escape: 'dismiss-help',
  Backspace: 'delete-scene',
  Delete: 'delete-scene',
  ArrowRight: 'next-scene',
  ArrowDown: 'next-scene',
  ArrowLeft: 'prev-scene',
  ArrowUp: 'prev-scene',
  ' ': 'toggle-play',
  ']': 'next-tool',
  '[': 'prev-tool',
};

// ⌘/Ctrl chords (Alt already excluded by the caller). `k` is the lower-cased key.
function resolveModShortcut(k: string, shiftKey: boolean): EditorShortcutAction | null {
  if (k === 'z') return shiftKey ? 'redo' : 'undo';

  if (k === 'y') return 'redo';

  if (k === 's') return 'save';

  if (k === 'd') return 'duplicate-scene';

  return null;
}

// Bare (optionally shifted) keys — table lookup, plus the lower-cased `n` for "add scene".
function resolveBareShortcut(e: KeyEventLike): EditorShortcutAction | null {
  const direct = BARE_KEY_ACTIONS[e.key] as EditorShortcutAction | undefined;

  if (direct) return direct;

  if (e.key.toLowerCase() === 'n') return 'add-scene';

  return null;
}

export function resolveShortcut(e: KeyEventLike): EditorShortcutAction | null {
  const mod = e.metaKey || e.ctrlKey;

  if (mod && !e.altKey) return resolveModShortcut(e.key.toLowerCase(), e.shiftKey);

  // Any other meta/ctrl combination (including Alt chords) is not a shortcut.
  if (mod) return null;

  return resolveBareShortcut(e);
}

export function isTypingTarget(t: TargetLike | null): boolean {
  if (!t) return false;

  if (t.isContentEditable) return true;

  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}
