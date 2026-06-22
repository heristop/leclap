// Inputs sit on `surface-inset` — the darkest step of the elevation ramp — so a field reads as a
// soft well cut into the lighter section card (not a stark white box), in both light and dark modes.
// A slightly stronger border reinforces the recessed edge.
export const EDITOR_INPUT_CLASS =
  'field-focus-gradient [--field-fill:var(--color-surface-inset)] w-full px-3 py-2 rounded-lg bg-surface-inset border border-foreground/15 text-foreground placeholder:text-gray-500 transition-colors hover:border-foreground/25';
