// Pure selection logic for a global text overlay's per-section targeting (global.overlays[].sections):
// undefined means "draw on every section", a non-empty array names the targeted scenes. Toggling the
// last name off collapses back to undefined so the descriptor only carries the field when it narrows.

export function toggleOverlaySection(sections: string[] | undefined, name: string): string[] | undefined {
  const current = sections ?? [];

  if (!current.includes(name)) return [...current, name];

  const next = current.filter((section) => section !== name);

  return next.length > 0 ? next : undefined;
}

// The chip list to offer: the template's renderable scene names, plus any targeted name that no
// longer exists in the template (e.g. a deleted scene) so a stale target stays visible and removable.
export function overlaySectionChoices(sectionNames: string[], targeted: string[] | undefined): string[] {
  const stale = (targeted ?? []).filter((name) => !sectionNames.includes(name));

  return [...sectionNames, ...stale];
}
