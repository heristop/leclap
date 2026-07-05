// Pure helpers for KineticHeading's staggered reveal — no React, so they unit-test cleanly.

// Split a heading into words, collapsing runs of whitespace and dropping empties.
export const splitWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

// Split a heading into explicit lines (author-controlled line breaks).
export const splitLines = (text: string): string[] => text.split('\n');

// The reveal delay for the nth token in the stagger (same unit as `step`).
export const staggerDelay = (index: number, step: number): number => Math.max(0, index) * step;

// The nth token's delay when the whole heading starts `offset` after mount (multi-line heroes:
// line two starts where line one's stagger ends). Negative offsets read as zero.
export const revealDelay = (index: number, step: number, offset: number): number =>
  Math.max(0, offset) + staggerDelay(index, step);
