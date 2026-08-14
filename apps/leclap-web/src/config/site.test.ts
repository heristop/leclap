// Drift guard for the route manifests. Three tables describe the site's URLs — LOCALIZED_ROUTES
// (translated, hreflang'd, one file per language), DOC_ROUTES (English-only reference pages) and
// UNINDEXED_PATHS (deliberately never crawled) — and none of them is derived from the router. So a
// new <Route> can silently ship with no prerendered <head>, no sitemap entry and no noindex, and a
// manifest entry can outlive the route it names, leaving a prerendered page that 404s on hydration.
//
// This asserts both directions, plus the seo.json side: every `seoKey` a localized route names must
// resolve to a title AND a description in all five locales, because scripts/seo-prerender.ts reads
// them unconditionally and would otherwise bake `undefined` into the <title> of a live page.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALE_CODES, LOCALIZED_ROUTES, UNINDEXED_PATHS } from './site';
import { DOC_ROUTES } from './doc-routes';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// React Router paths are relative to their parent, except the root splat, which the manifests spell
// exactly as the router does ('*').
function joinPath(parent: string, child: string): string {
  if (child.startsWith('/') || child === '*') {
    return child;
  }

  return `${parent === '/' ? '' : parent}/${child}`;
}

type RouteTag = { attrs: string; selfClosing: boolean };

/**
 * The `<Route …>` / `</Route>` tags in `App.tsx`, in source order.
 *
 * Deliberately not line-based: prettier wraps a <Route> across lines as soon as its attributes get
 * long, and a line-oriented scanner would simply stop seeing that route — the drift test would keep
 * passing while the drift it exists to catch shipped. So this walks the source character by
 * character, tracking brace depth and quotes so the `/>` inside `element={<Home />}` is not mistaken
 * for the end of the Route tag, and newlines inside a tag are just whitespace.
 */
function routeTags(source: string): (RouteTag | 'close')[] {
  const tags: (RouteTag | 'close')[] = [];
  let i = 0;

  while (i < source.length) {
    if (source.startsWith('</Route>', i)) {
      tags.push('close');
      i += '</Route>'.length;
      continue;
    }

    // `<Route` must be the whole element name: `errorElement={<RouteError />}` is not a route.
    if (!/^<Route[\s/>]/.test(source.slice(i, i + 7))) {
      i += 1;
      continue;
    }

    let depth = 0;
    let quote = '';
    let j = i + '<Route'.length;

    for (; j < source.length; j += 1) {
      const c = source[j];

      if (quote !== '') {
        if (c === quote) {
          quote = '';
        }
        continue;
      }

      if (c === '"' || c === "'") {
        quote = c;
        continue;
      }

      if (c === '{') {
        depth += 1;
        continue;
      }

      if (c === '}') {
        depth -= 1;
        continue;
      }

      if (c === '>' && depth === 0) {
        break;
      }
    }

    const attrs = source.slice(i + '<Route'.length, j);
    tags.push({ attrs, selfClosing: attrs.trimEnd().endsWith('/') });
    i = j + 1;
  }

  return tags;
}

/**
 * The paths `App.tsx` actually serves, read from its source rather than by importing it — importing
 * the router would pull the whole app (and its WASM-loading pages) into a node-environment test.
 */
function routerPaths(source: string): string[] {
  const found: string[] = [];
  const stack: string[] = ['/'];

  for (const tag of routeTags(source)) {
    if (tag === 'close') {
      stack.pop();
      continue;
    }

    const parent = stack.at(-1) ?? '/';
    const match = /\bpath\s*=\s*"([^"]+)"/.exec(tag.attrs);
    const resolved = match ? joinPath(parent, match[1]) : parent;

    if (match || /(^|\s)index(\s|$)/.test(tag.attrs)) {
      found.push(resolved);
    }

    if (!tag.selfClosing) {
      stack.push(resolved);
    }
  }

  return found;
}

const served = new Set(routerPaths(readFileSync(path.join(srcDir, 'App.tsx'), 'utf8')));

const seoByLocale = Object.fromEntries(
  LOCALE_CODES.map((lng) => [
    lng,
    JSON.parse(readFileSync(path.join(srcDir, 'i18n/locales', lng, 'seo.json'), 'utf8')) as Record<
      string,
      { title?: string; description?: string } | undefined
    >,
  ])
);

describe('site route manifests', () => {
  it('parses a plausible router (guards the parser itself)', () => {
    expect(served.size).toBeGreaterThan(20);
    expect(served.has('/')).toBe(true);
    expect(served.has('/doc/sections')).toBe(true);
  });

  // The failure this guards against is silent: a wrapped route disappears from `served`, and every
  // assertion below still passes because they only ever check what the parser found.
  it('sees a route whose attributes are wrapped across lines', () => {
    const wrapped = [
      '<Route element={<RootLayout />} errorElement={<RouteError />}>',
      '  <Route path="/" element={<Home />} />',
      '  <Route',
      '    path="/compare/remotion"',
      '    element={<CompareRemotion />}',
      '  />',
      '  <Route path="/doc" element={<DocLayout />}>',
      '    <Route index element={<DocOverview />} />',
      '    <Route path="sections" element={<DocSections />} />',
      '  </Route>',
      '  <Route path="*" element={<NotFound />} />',
      '</Route>',
    ].join('\n');

    // Deduped because an `index` route resolves to its parent's path, which the parent already emitted.
    expect([...new Set(routerPaths(wrapped))]).toEqual(['/', '/compare/remotion', '/doc', '/doc/sections', '*']);
  });

  it('classifies every route the router serves', () => {
    const classified = new Set<string>([
      ...LOCALIZED_ROUTES.map((r) => r.path),
      ...DOC_ROUTES.map((r) => r.path),
      ...UNINDEXED_PATHS,
    ]);

    expect([...served].filter((p) => !classified.has(p))).toEqual([]);
  });

  it('serves every path the manifests claim', () => {
    const claimed = [...LOCALIZED_ROUTES.map((r) => r.path), ...DOC_ROUTES.map((r) => r.path), ...UNINDEXED_PATHS];

    expect(claimed.filter((p) => !served.has(p))).toEqual([]);
  });

  it('never lists a path twice across the three tables', () => {
    const all = [...LOCALIZED_ROUTES.map((r) => r.path), ...DOC_ROUTES.map((r) => r.path), ...UNINDEXED_PATHS];

    expect(all.length).toBe(new Set(all).size);
  });
});

describe('localized route copy', () => {
  it.each(LOCALE_CODES)('resolves every seoKey to a title and a description in %s', (lng) => {
    const missing = LOCALIZED_ROUTES.filter((route) => {
      const entry = seoByLocale[lng][route.seoKey];

      return !entry?.title || !entry.description;
    });

    expect(missing.map((r) => r.seoKey)).toEqual([]);
  });
});
