import { describe, it, expect } from 'vitest';
import { isTextEditingTarget, trimKeyTarget } from './editor-keys';

describe('trimKeyTarget', () => {
  it('nudges an edge by a tenth of a second with the arrows', () => {
    expect(trimKeyTarget('ArrowRight', false, 1.2, 10)).toBe(1.3);
    expect(trimKeyTarget('ArrowLeft', false, 1.2, 10)).toBe(1.1);
  });

  it('takes whole-second steps with Shift', () => {
    expect(trimKeyTarget('ArrowUp', true, 1.2, 10)).toBe(2.2);
    expect(trimKeyTarget('ArrowDown', true, 1.2, 10)).toBe(0.2);
  });

  it('jumps to the clip’s bounds with Home and End', () => {
    expect(trimKeyTarget('Home', false, 4, 10)).toBe(0);
    expect(trimKeyTarget('End', false, 4, 10)).toBe(10);
  });

  it('ignores keys the handle does not use', () => {
    expect(trimKeyTarget('Enter', false, 4, 10)).toBeNull();
    expect(trimKeyTarget('a', true, 4, 10)).toBeNull();
  });
});

describe('isTextEditingTarget', () => {
  it('recognises fields and editable regions, where ⌘Z undoes the typing', () => {
    expect(isTextEditingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTextEditingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEditingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('leaves everything else to the editor’s own undo', () => {
    expect(isTextEditingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextEditingTarget({ tagName: 'BODY', isContentEditable: false })).toBe(false);
    expect(isTextEditingTarget(null)).toBe(false);
  });
});
