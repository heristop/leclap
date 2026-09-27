// Keyboard nudge for a trim handle (role="slider"): the arrows move the edge by a tenth of a second,
// Shift by a whole second, Home/End jump to the clip's bounds. Returns the new source time, or null for
// a key the handle doesn't use; keeping the edge inside its segment stays trimEdge's job. Rounded to
// hundredths so repeated nudges don't drift into 1.0999999.
export const trimKeyTarget = (key: string, shiftKey: boolean, value: number, duration: number): number | null => {
  const step = shiftKey ? 1 : 0.1;
  const round = (seconds: number): number => Math.round(seconds * 100) / 100;

  if (key === 'ArrowRight' || key === 'ArrowUp') return round(value + step);

  if (key === 'ArrowLeft' || key === 'ArrowDown') return round(value - step);

  if (key === 'Home') return 0;

  if (key === 'End') return duration;

  return null;
};

interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

// ⌘Z/Ctrl+Z belongs to a text field while it has focus — it must undo the typing, not the last cut.
export const isTextEditingTarget = (target: KeyTarget | null): boolean => {
  if (!target) return false;

  if (target.isContentEditable) return true;

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
};
