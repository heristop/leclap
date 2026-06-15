#!/usr/bin/env node
// Heuristic guard against hardcoded user-facing strings in the apps. Flags literal
// JSX text and literal string-valued user-facing props (aria-label, placeholder, …)
// plus Alert.alert() literals that aren't routed through i18next's t(). It's a
// lint-style safety net, not a parser — annotate a deliberate literal with a
// trailing `// i18n-ignore` (or the line above) to silence it.
//
// Usage: node scripts/i18n-check.ts   (exits 1 if any findings)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

interface Finding {
  file: string;
  line: number;
  kind: string;
  text: string;
}

const ROOTS = ['apps/leclap-web/src', 'apps/leclap-expo/src', 'apps/leclap-expo/app'];

// Skip generated/non-UI areas and tests.
const SKIP_DIR = /(^|\/)(node_modules|__tests__|i18n\/locales|dist|build|\.expo)(\/|$)/;
const SKIP_FILE = /(\.test\.|\.spec\.|\.d\.ts$|\.stories\.)/;

// Out of scope for product i18n: internal docs + design-system showcase pages (which embed
// code samples), the on-device dev spike, and legacy/unrouted screens. Tracked but not gated.
const EXCLUDE = [
  'apps/leclap-web/src/presentation/pages/Doc.tsx',
  'apps/leclap-web/src/presentation/pages/Design.tsx',
  'apps/leclap-web/src/presentation/components/doc/',
  'apps/leclap-expo/app/(fullscreen)/ffmpeg-spike.tsx',
  'apps/leclap-expo/src/features/editor/screens/EditorScreen.tsx',
  'apps/leclap-expo/src/features/editor/screens/VideoRecordingScreen.tsx',
];
const isExcluded = (p: string) => EXCLUDE.some((e) => p.includes(e));

// User-facing string-valued JSX props that must be translated.
const ATTR = /\b(aria-label|accessibilityLabel|placeholder|title|alt)=["']([^"'{}]*[A-Za-z]{2,}[^"'{}]*)["']/g;
const ALERT = /Alert\.alert\(\s*["']([^"']*[A-Za-z]{2,}[^"']*)["']/g;
// JSX text between tags on a single line, e.g. >Save template<
const JSXTEXT = />([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g;

// Attribute/alert values look human when they aren't bare identifiers/urls/paths.
const looksHuman = (s: string) => {
  const v = s.trim();

  if (v.length < 2) return false;

  if (/^[a-z0-9_.-]+$/.test(v)) return false;
  // identifiers / css / file tokens
  if (/^https?:\/\//.test(v) || /^[#/.]/.test(v)) return false;
  // urls / paths / hex
  return /\s/.test(v) || /^[A-Z][a-z]/.test(v);
};

// Stricter test for JSX text nodes: real UI copy is words + light punctuation only.
// This rejects TS generics / expressions wrongly caught by the `>…<` scan, e.g.
// "): Promise", "0 && t.end", "void | Promise", "s.get(key) as IDBRequest".
// Single-word TS type names that slip through `>…<` as generic-return fragments.
const TS_TYPES = new Set(['Promise', 'Array', 'Record', 'Map', 'Set', 'Partial', 'Readonly', 'Awaited', 'ReturnType']);

const looksProse = (s: string) => {
  const v = s.replace(/&[a-z]+;/g, ' ').trim();
  // collapse HTML entities (&amp; etc.)
  if (v.length < 2 || !/[A-Za-z]{2,}/.test(v)) return false;

  if (!/^[A-Za-z]/.test(v)) return false;
  // must start with a letter
  return /^[A-Za-z0-9 ,.!?'’%–—-]+$/.test(v); // words + light punctuation only
};

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (SKIP_DIR.test(p)) continue;
    const s = statSync(p);

    if (s.isDirectory()) {
      walk(p);
      continue;
    }

    if ((extname(p) === '.tsx' || extname(p) === '.ts') && !SKIP_FILE.test(p)) files.push(p);
  }
};

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // root may not exist in a partial checkout — skip it.
  }
}

// Scan the literal JSX text nodes on a line (`.tsx` only) and push any prose findings.
// Kept separate so the main loop stays simple.
const scanJsxText = (file: string, line: string, lineNo: number, out: Finding[]) => {
  if (!file.endsWith('.tsx')) return;

  for (const m of line.matchAll(JSXTEXT)) {
    // Skip `=> Promise<…>` arrow-return generics: the leading `>` belongs to `=>`.
    if (line[m.index - 1] === '=') continue;

    if (TS_TYPES.has(m[1].trim())) continue;

    if (looksProse(m[1])) out.push({ file, line: lineNo, kind: 'jsx-text', text: m[1].trim() });
  }
};

const scanLine = (file: string, lines: string[], i: number, out: Finding[]) => {
  const line = lines[i];

  if (line.includes('i18n-ignore') || (i > 0 && lines[i - 1].includes('i18n-ignore'))) return;

  for (const m of line.matchAll(ATTR)) {
    if (looksHuman(m[2])) out.push({ file, line: i + 1, kind: m[1], text: m[2].trim() });
  }

  for (const m of line.matchAll(ALERT)) {
    if (looksHuman(m[1])) out.push({ file, line: i + 1, kind: 'Alert.alert', text: m[1].trim() });
  }

  scanJsxText(file, line, i + 1, out);
};

const findings: Finding[] = [];

for (const file of files) {
  if (isExcluded(file)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) scanLine(file, lines, i, findings);
}

if (findings.length === 0) {
  console.log(`i18n-check: no hardcoded user-facing strings found across ${files.length} files.`);
  process.exit(0);
}

console.error(`i18n-check: ${findings.length} possible hardcoded string(s):\n`);

for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.kind}]  ${JSON.stringify(f.text)}`);
}
console.error('\nWrap each in t(...) or annotate the line with `// i18n-ignore` if intentional.');
process.exit(1);
