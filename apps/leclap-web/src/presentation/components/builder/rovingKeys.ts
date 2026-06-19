// Next focus index for an arrow-key roving group (toolbar / tablist), or -1 to ignore the key. Wraps
// at both ends; Home/End jump to the edges. Accepts both axes so the same handler works for a vertical
// rail and a horizontal strip.
export function arrowTarget(key: string, from: number, last: number): number {
  if (key === 'ArrowRight' || key === 'ArrowDown') return from >= last ? 0 : from + 1;

  if (key === 'ArrowLeft' || key === 'ArrowUp') return from <= 0 ? last : from - 1;

  if (key === 'Home') return 0;

  if (key === 'End') return last;

  return -1;
}
