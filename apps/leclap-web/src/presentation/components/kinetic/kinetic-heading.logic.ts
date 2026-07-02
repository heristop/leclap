// Pure alignment mapping for KineticHeading — no React, so it unit-tests cleanly.

export type HeadingAlign = 'left' | 'center' | 'responsive';

// Map an alignment intent to the flex `justify-*` utilities. `responsive` centres on mobile and
// switches to left-aligned at `lg+` (the `text-center lg:text-left` case) without breaking the
// existing `left`/`center` callers.
export const alignJustify = (align: HeadingAlign): string => {
  if (align === 'center') return 'justify-center';

  if (align === 'responsive') return 'justify-center lg:justify-start';

  return 'justify-start';
};
