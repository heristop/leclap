// The ordered docs table of contents — drives the sidebar nav and the prev/next pager. One entry per
// route under `/doc`. `end` marks the index route so it only highlights on an exact match.
export interface DocNavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const docNav: readonly DocNavItem[] = [
  { to: '/doc', label: 'Overview', end: true },
  { to: '/doc/sections', label: 'Sections & types' },
  { to: '/doc/transitions', label: 'Transitions' },
  { to: '/doc/looks', label: 'Looks' },
  { to: '/doc/grade', label: 'Colour grade' },
  { to: '/doc/motion', label: 'Motion & layers' },
  { to: '/doc/audio', label: 'Audio' },
  { to: '/doc/captions', label: 'Captions' },
  { to: '/doc/animations', label: 'Animations & images' },
  { to: '/doc/filters', label: 'Filters & maps' },
  { to: '/doc/examples', label: 'Examples' },
  { to: '/doc/schema', label: 'JSON Schema' },
];
