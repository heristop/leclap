// Add `id` if absent, drop it if present — the pure shortlist toggle used by the
// music/image media pickers.
export const toggleId = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
