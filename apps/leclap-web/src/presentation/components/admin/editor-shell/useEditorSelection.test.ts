import { describe, it, expect } from 'vitest';
import { indexAfterReorder } from './useEditorSelection';

describe('indexAfterReorder — selection follows its section across a reorder', () => {
  it('follows the moved section itself', () => {
    expect(indexAfterReorder(2, 2, 5)).toBe(5);
    expect(indexAfterReorder(5, 5, 1)).toBe(1);
  });
  it('shifts left when an earlier section moves past it (rightward move)', () => {
    expect(indexAfterReorder(3, 1, 4)).toBe(2); // 1→4 pulls 3 down to 2
    expect(indexAfterReorder(0, 1, 4)).toBe(0); // unaffected (before the range)
    expect(indexAfterReorder(5, 1, 4)).toBe(5); // unaffected (after the range)
  });
  it('shifts right when a later section moves before it (leftward move)', () => {
    expect(indexAfterReorder(2, 5, 1)).toBe(3); // 5→1 pushes 2 to 3
    expect(indexAfterReorder(0, 5, 1)).toBe(0); // before the range
  });
});
