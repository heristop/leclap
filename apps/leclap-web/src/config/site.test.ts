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

/**
 * The paths `App.tsx` actually serves, read from its source rather than by importing it — importing
 * the router would pull the whole app (and its WASM-loading pages) into a node-environment test.
 * Every <Route> in that file is a single line, which is what prettier produces and what this parses.
 */
function routerPaths(source: string): string[] {
  const found: string[] = [];
  const stack: string[] = ['/'];

  for (const raw of source.split('\n')) {
    const line = raw.trim();

    if (line.startsWith('</Route>')) {
      stack.pop();
      continue;
    }

    if (!line.startsWith('<Route')) {
      continue;
    }

    const parent = stack.at(-1) ?? '/';
    const match = /path="([^"]+)"/.exec(line);
    const resolved = match ? joinPath(parent, match[1]) : parent;

    if (match || line.includes('<Route index')) {
      found.push(resolved);
    }

    if (!line.endsWith('/>')) {
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
