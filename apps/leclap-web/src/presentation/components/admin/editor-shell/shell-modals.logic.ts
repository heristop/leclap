// The builder shows one overlay at a time: help, the starter presets or the Generate-with-AI drawer.
// Opening one replaces whichever is up (presets → "Generate with AI" swaps the picker for the drawer
// instead of stacking it on top), and a close only clears the overlay it names, so a late close from
// an overlay that was already replaced never dismisses its successor.
export type ShellModal = 'help' | 'presets' | 'ai';

export function closeModal(active: ShellModal | null, kind: ShellModal): ShellModal | null {
  return active === kind ? null : active;
}

export function setModalOpen(active: ShellModal | null, kind: ShellModal, open: boolean): ShellModal | null {
  return open ? kind : closeModal(active, kind);
}
