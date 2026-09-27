// The studio's projects shelf shows one row of the most recent projects until the visitor asks for the
// rest. Its grid runs one or two columns below `lg` and four from `lg` up, so a row is two cards on narrow
// screens and four on wide ones.
const ROW_NARROW = 2;
const ROW_WIDE = 4;

export interface ShelfLayout {
  /** Cards from this index on are hidden below the wide breakpoint. */
  hiddenBelowWideFrom: number;
  /** Cards from this index on are hidden everywhere. */
  hiddenFrom: number;
  /** Where the show-all toggle appears: nowhere, only below the wide breakpoint, or at every width. */
  toggle: 'none' | 'narrow' | 'always';
}

const toggleFor = (count: number): ShelfLayout['toggle'] => {
  if (count > ROW_WIDE) return 'always';

  if (count > ROW_NARROW) return 'narrow';

  return 'none';
};

/** Which of `count` projects the shelf shows, and where it offers to show the rest (or fewer). */
export const shelfLayout = (count: number, expanded: boolean): ShelfLayout => {
  if (expanded) return { hiddenBelowWideFrom: count, hiddenFrom: count, toggle: toggleFor(count) };

  return { hiddenBelowWideFrom: ROW_NARROW, hiddenFrom: ROW_WIDE, toggle: toggleFor(count) };
};
