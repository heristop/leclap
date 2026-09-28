import { describe, expect, it } from 'vitest';
import { activeHeadingId, docPageAt, docPager, normalizeDocPath } from './doc-nav.logic';
import { docNav, docNavGroups } from './docNav';

const items = [
  { to: '/doc', label: 'Overview', end: true },
  { to: '/doc/sections', label: 'Sections & types' },
  { to: '/doc/mcp', label: 'MCP server' },
];

describe('normalizeDocPath', () => {
  it('drops a trailing slash so /doc/ and /doc name the same page', () => {
    expect(normalizeDocPath('/doc/')).toBe('/doc');
    expect(normalizeDocPath('/doc/sections/')).toBe('/doc/sections');
  });

  it('leaves clean paths and the root alone', () => {
    expect(normalizeDocPath('/doc/mcp')).toBe('/doc/mcp');
    expect(normalizeDocPath('/')).toBe('/');
  });
});

describe('docPageAt', () => {
  it('finds the page for a path, trailing slash or not', () => {
    expect(docPageAt(items, '/doc/sections')?.label).toBe('Sections & types');
    expect(docPageAt(items, '/doc/')?.label).toBe('Overview');
  });

  it('returns null off the docs map', () => {
    expect(docPageAt(items, '/doc/nope')).toBeNull();
  });
});

describe('docPager', () => {
  it('has no previous page on the first entry', () => {
    expect(docPager(items, '/doc')).toEqual({ prev: null, next: items[1] });
  });

  it('links both neighbours in the middle', () => {
    expect(docPager(items, '/doc/sections')).toEqual({ prev: items[0], next: items[2] });
  });

  it('has no next page on the last entry', () => {
    expect(docPager(items, '/doc/mcp')).toEqual({ prev: items[1], next: null });
  });

  it('renders nothing for an unknown path', () => {
    expect(docPager(items, '/doc/nope')).toEqual({ prev: null, next: null });
  });
});

describe('activeHeadingId', () => {
  const headings = [
    { id: 'shape', top: 40 },
    { id: 'rendering', top: 500 },
    { id: 'global', top: 1400 },
  ];

  it('is null with no headings', () => {
    expect(activeHeadingId([], 120, false)).toBeNull();
  });

  it('is null while the reader is still above the first section', () => {
    expect(
      activeHeadingId(
        headings.map((heading) => ({ ...heading, top: heading.top + 200 })),
        120,
        false
      )
    ).toBeNull();
  });

  it('picks the last heading that has scrolled past the threshold', () => {
    expect(activeHeadingId(headings, 120, false)).toBe('shape');
    expect(activeHeadingId(headings, 600, false)).toBe('rendering');
  });

  it('counts a heading sitting exactly on the threshold, where an anchor jump parks it', () => {
    expect(activeHeadingId(headings, 500, false)).toBe('rendering');
  });

  it('hands the last heading over at the bottom of the page, where a short final section never reaches the threshold', () => {
    expect(activeHeadingId(headings, 120, true)).toBe('global');
  });
});

describe('docNav', () => {
  it('is the groups flattened in reading order, so the pager walks the sidebar top to bottom', () => {
    expect(docNav).toEqual(docNavGroups.flatMap((group) => group.items));
  });

  it('lists every route once', () => {
    const paths = docNav.map((item) => item.to);

    expect(new Set(paths).size).toBe(paths.length);
  });
});
