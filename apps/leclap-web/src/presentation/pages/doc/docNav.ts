// The ordered docs table of contents — drives the sidebar nav, the phone doc bar and the prev/next
// pager. One entry per route under `/doc`. `end` marks the index route so it only highlights on an
// exact match.
export interface DocNavItem {
  to: string;
  label: string;
  end?: boolean;
}

// Fourteen flat links read as one undifferentiated column; three labelled groups let the eye jump to
// "the reference", "something to copy" or "a front-end" before reading a single item.
export interface DocNavGroup {
  label: string;
  items: readonly DocNavItem[];
}

export const docNavGroups: readonly DocNavGroup[] = [
  {
    label: 'Template descriptor',
    items: [
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
    ],
  },
  {
    label: 'Resources',
    items: [
      { to: '/doc/examples', label: 'Examples' },
      { to: '/doc/schema', label: 'JSON Schema' },
    ],
  },
  // The two front-ends that drive the descriptor above, last so the reference reads first.
  {
    label: 'Tools',
    items: [
      { to: '/doc/cli', label: 'Command line' },
      { to: '/doc/mcp', label: 'MCP server' },
    ],
  },
];

// The same pages in reading order, for the pager: walking it is walking the sidebar top to bottom.
export const docNav: readonly DocNavItem[] = docNavGroups.flatMap((group) => group.items);
