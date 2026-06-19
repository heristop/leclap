import { describe, it, expect } from 'vitest';
import { addRush, selectRush, removeRush, type RushModel } from './rushActions';

const fileOf = (name: string): File => new File([new Uint8Array([1])], name, { type: 'video/mp4' });

const emptyModel = (): RushModel => ({ clipsBySection: {}, rushesBySection: {}, editsBySection: {} });

describe('addRush', () => {
  it('adds the first rush and auto-selects it', () => {
    const take = fileOf('take-1.mp4');
    const next = addRush(emptyModel(), 'clip_1', take);

    expect(next.rushesBySection.clip_1).toEqual([take]);
    expect(next.clipsBySection.clip_1).toBe(take);
  });

  it('appends a second rush but leaves the existing selection', () => {
    const first = fileOf('take-1.mp4');
    const second = fileOf('take-2.mp4');
    const next = addRush(addRush(emptyModel(), 'clip_1', first), 'clip_1', second);

    expect(next.rushesBySection.clip_1).toEqual([first, second]);
    expect(next.clipsBySection.clip_1).toBe(first);
  });

  it('does not mutate the input model', () => {
    const model = emptyModel();
    addRush(model, 'clip_1', fileOf('take-1.mp4'));

    expect(model.rushesBySection.clip_1).toBeUndefined();
    expect(model.clipsBySection.clip_1).toBeUndefined();
  });
});

describe('selectRush', () => {
  it('switches the selection and resets the section edit', () => {
    const first = fileOf('take-1.mp4');
    const second = fileOf('take-2.mp4');
    const base: RushModel = {
      clipsBySection: { clip_1: first },
      rushesBySection: { clip_1: [first, second] },
      editsBySection: { clip_1: { trim: { start: 0, end: 5 } } },
    };

    const next = selectRush(base, 'clip_1', second);

    expect(next.clipsBySection.clip_1).toBe(second);
    expect(next.editsBySection.clip_1).toBeUndefined();
  });

  it('still selects a file that is not in the section rushes', () => {
    const orphan = fileOf('orphan.mp4');
    const next = selectRush(emptyModel(), 'clip_1', orphan);

    expect(next.clipsBySection.clip_1).toBe(orphan);
  });
});

describe('removeRush', () => {
  it('removes a non-selected rush and keeps the selection', () => {
    const first = fileOf('take-1.mp4');
    const second = fileOf('take-2.mp4');
    const base: RushModel = {
      clipsBySection: { clip_1: first },
      rushesBySection: { clip_1: [first, second] },
      editsBySection: {},
    };

    const next = removeRush(base, 'clip_1', second);

    expect(next.rushesBySection.clip_1).toEqual([first]);
    expect(next.clipsBySection.clip_1).toBe(first);
  });

  it('removes the selected rush and falls back to the first remaining', () => {
    const first = fileOf('take-1.mp4');
    const second = fileOf('take-2.mp4');
    const base: RushModel = {
      clipsBySection: { clip_1: first },
      rushesBySection: { clip_1: [first, second] },
      editsBySection: { clip_1: { trim: { start: 0, end: 5 } } },
    };

    const next = removeRush(base, 'clip_1', first);

    expect(next.rushesBySection.clip_1).toEqual([second]);
    expect(next.clipsBySection.clip_1).toBe(second);
    expect(next.editsBySection.clip_1).toBeUndefined();
  });

  it('clears the selection and edit when the last rush is removed', () => {
    const only = fileOf('take-1.mp4');
    const base: RushModel = {
      clipsBySection: { clip_1: only },
      rushesBySection: { clip_1: [only] },
      editsBySection: { clip_1: { trim: { start: 0, end: 5 } } },
    };

    const next = removeRush(base, 'clip_1', only);

    expect(next.rushesBySection.clip_1).toEqual([]);
    expect(next.clipsBySection.clip_1).toBeUndefined();
    expect(next.editsBySection.clip_1).toBeUndefined();
  });
});
