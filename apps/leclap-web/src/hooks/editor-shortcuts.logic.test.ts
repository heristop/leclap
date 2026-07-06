import { describe, it, expect } from 'vitest';
import {
  resolveShortcut,
  isTypingTarget,
  ALWAYS_ALLOW_IN_INPUTS,
  type KeyEventLike,
} from './editor-shortcuts.logic';

const key = (over: Partial<KeyEventLike>): KeyEventLike => ({
  key: '',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe('resolveShortcut', () => {
  it('maps undo on mod+z (meta or ctrl)', () => {
    expect(resolveShortcut(key({ key: 'z', metaKey: true }))).toBe('undo');
    expect(resolveShortcut(key({ key: 'z', ctrlKey: true }))).toBe('undo');
  });

  it('maps redo on mod+shift+z and mod+y', () => {
    expect(resolveShortcut(key({ key: 'z', metaKey: true, shiftKey: true }))).toBe('redo');
    expect(resolveShortcut(key({ key: 'y', ctrlKey: true }))).toBe('redo');
  });

  it('is case-insensitive for letter combos', () => {
    expect(resolveShortcut(key({ key: 'Z', metaKey: true }))).toBe('undo');
    expect(resolveShortcut(key({ key: 'S', metaKey: true }))).toBe('save');
  });

  it('maps save on mod+s and duplicate on mod+d', () => {
    expect(resolveShortcut(key({ key: 's', metaKey: true }))).toBe('save');
    expect(resolveShortcut(key({ key: 'd', metaKey: true }))).toBe('duplicate-scene');
  });

  it('maps delete on Backspace and Delete', () => {
    expect(resolveShortcut(key({ key: 'Backspace' }))).toBe('delete-scene');
    expect(resolveShortcut(key({ key: 'Delete' }))).toBe('delete-scene');
  });

  it('maps scene navigation on bare arrows', () => {
    expect(resolveShortcut(key({ key: 'ArrowRight' }))).toBe('next-scene');
    expect(resolveShortcut(key({ key: 'ArrowDown' }))).toBe('next-scene');
    expect(resolveShortcut(key({ key: 'ArrowLeft' }))).toBe('prev-scene');
    expect(resolveShortcut(key({ key: 'ArrowUp' }))).toBe('prev-scene');
  });

  it('maps add scene on n, play on space, tools on brackets', () => {
    expect(resolveShortcut(key({ key: 'n' }))).toBe('add-scene');
    expect(resolveShortcut(key({ key: ' ' }))).toBe('toggle-play');
    expect(resolveShortcut(key({ key: ']' }))).toBe('next-tool');
    expect(resolveShortcut(key({ key: '[' }))).toBe('prev-tool');
  });

  it('maps help on ? and dismiss on Escape', () => {
    expect(resolveShortcut(key({ key: '?' }))).toBe('show-help');
    expect(resolveShortcut(key({ key: '?', shiftKey: true }))).toBe('show-help');
    expect(resolveShortcut(key({ key: 'Escape' }))).toBe('dismiss-help');
  });

  it('does not treat modified bare keys as shortcuts', () => {
    expect(resolveShortcut(key({ key: 'n', metaKey: true }))).toBeNull();
    expect(resolveShortcut(key({ key: 'ArrowRight', metaKey: true }))).toBeNull();
    expect(resolveShortcut(key({ key: ' ', ctrlKey: true }))).toBeNull();
  });

  it('returns null for unhandled keys', () => {
    expect(resolveShortcut(key({ key: 'q' }))).toBeNull();
    expect(resolveShortcut(key({ key: 'Enter' }))).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('is true for inputs, textareas, selects and contenteditable', () => {
    expect(isTypingTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT', isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('is false for non-typing elements and null', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON', isContentEditable: false })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('ALWAYS_ALLOW_IN_INPUTS', () => {
  it('lets mod-combos and help fire even while typing', () => {
    expect(ALWAYS_ALLOW_IN_INPUTS.has('undo')).toBe(true);
    expect(ALWAYS_ALLOW_IN_INPUTS.has('redo')).toBe(true);
    expect(ALWAYS_ALLOW_IN_INPUTS.has('save')).toBe(true);
    expect(ALWAYS_ALLOW_IN_INPUTS.has('dismiss-help')).toBe(true);
  });

  it('does not include destructive bare-key actions', () => {
    expect(ALWAYS_ALLOW_IN_INPUTS.has('delete-scene')).toBe(false);
    expect(ALWAYS_ALLOW_IN_INPUTS.has('toggle-play')).toBe(false);
  });
});
