// Render a LeClap template with the real engine (the @leclap/cli render command) — shared by the
// showcase's media scripts, so every "result" clip in the film is genuine engine output.
//
// It stages what a descriptor references into a throwaway workspace (assets/<dir>/<file>, where the
// Node adapter resolves `/assets/...` and canonical asset URLs), inlines creative-kit partials, maps
// project_video sections to clips, validates, and renders. FFmpeg must have drawtext (libfreetype) for
// title cards and lower thirds — Homebrew's current build doesn't, so ffmpeg-static goes first on PATH.
//
// Needs packages/leclap-cli built (pnpm --filter @leclap/cli build).
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../../..');
export const KIT = path.join(REPO, 'packages/leclap-creative-kit/src');
const CLI = path.join(REPO, 'packages/leclap-cli/dist/index.js');

interface Section {
  type?: string;
  ref?: string;
  [key: string]: unknown;
}

interface Descriptor {
  global?: { variables?: Record<string, string>; [key: string]: unknown };
  sections: Section[];
  [key: string]: unknown;
}

export interface EngineRender {
  /** Path to the template JSON. */
  template: string;
  /** project_video section name → clip path. */
  videos: Record<string, string>;
  /** Template variables / form fields. */
  fields?: Record<string, string>;
  /** Library files to stage, relative to creative-kit's library/ (e.g. "animations/glow_border.apng"). */
  assets?: readonly string[];
  /** The locale the engine renders text in (`--locale`). Default: en. */
  locale?: string;
  /** The template's own strings in `locale`, keyed by their English text (see withLocale). */
  translations?: Translations;
  /**
   * Any other local files to stage, keyed by their path in the render workspace → source file. E.g.
   * "assets/pictures/logo.png" (a template's `/assets/pictures/logo.png`) or "build/fonts/Rubik.ttf"
   * (pre-fills the engine's font cache, so drawtext never depends on a network fetch).
   */
  files?: Readonly<Record<string, string>>;
  out: string;
}

type Translations = Readonly<Partial<Record<string, string>>>;

/** A locale-keyed text map (`{ "en": "BEFORE" }`): every value a string, English among them. */
const isTranslationMap = (value: unknown): value is { en: string } & Translations =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'en' in value &&
  Object.values(value).every((entry) => typeof entry === 'string');

/**
 * Give every translation map in the staged copy a `locale` entry: the engine reads text in the current
 * locale only, with no fallback, so a template that ships English alone renders blank text in any other
 * locale. The entry comes from `translations` (keyed by the English), else stays English — `{{ variables }}`
 * need no translation. A no-op for English.
 */
const withLocale = (node: unknown, locale: string, translations: Translations): unknown => {
  if (Array.isArray(node)) return node.map((child) => withLocale(child, locale, translations));

  if (isTranslationMap(node)) return { ...node, [locale]: node[locale] ?? translations[node.en] ?? node.en };

  if (typeof node !== 'object' || node === null) return node;

  return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, withLocale(child, locale, translations)]));
};

/**
 * The engine resolves `global.variables` before CLI fields, so `--field brand=…` can't override a
 * variable the template declares (it only fills form fields). Until that precedence is fixed in the
 * engine, write overriding values into the staged copy's variables.
 */
const withFieldOverrides = (descriptor: Descriptor, fields: Record<string, string>): Descriptor => {
  const variables = descriptor.global?.variables;

  if (!variables) return descriptor;

  const overridden = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, fields[key] ?? value]));

  return { ...descriptor, global: { ...descriptor.global, variables: overridden } };
};

/** Replace `{ type: "partial", ref }` sections with the creative-kit partial's sections. */
const inlinePartials = (descriptor: Descriptor): Descriptor => ({
  ...descriptor,
  sections: descriptor.sections.flatMap((section) => {
    if (section.type !== 'partial' || !section.ref) return [section];

    const partial = JSON.parse(readFileSync(path.join(KIT, 'partials', `${section.ref}.json`), 'utf8')) as Descriptor;

    return partial.sections;
  }),
});

export const renderWithEngine = ({
  template,
  videos,
  fields = {},
  assets = [],
  locale = 'en',
  translations = {},
  files = {},
  out,
}: EngineRender): void => {
  const work = mkdtempSync(path.join(os.tmpdir(), 'leclap-engine-render-'));

  try {
    const descriptor = withFieldOverrides(
      inlinePartials(JSON.parse(readFileSync(template, 'utf8')) as Descriptor),
      fields
    );
    writeFileSync(
      path.join(work, 'template.json'),
      JSON.stringify(withLocale(descriptor, locale, translations), null, 2)
    );

    for (const asset of assets) {
      mkdirSync(path.join(work, 'assets', path.dirname(asset)), { recursive: true });
      copyFileSync(path.join(KIT, 'library', asset), path.join(work, 'assets', asset));
    }

    for (const [staged, source] of Object.entries(files)) {
      mkdirSync(path.join(work, path.dirname(staged)), { recursive: true });
      copyFileSync(source, path.join(work, staged));
    }

    const clipArgs = Object.entries(videos).flatMap(([section, clip], index) => {
      const staged = path.join(work, `clip-${index}${path.extname(clip)}`);
      copyFileSync(clip, staged);

      return ['--video', `${section}=${path.basename(staged)}`];
    });
    const fieldArgs = Object.entries(fields).flatMap(([key, value]) => ['--field', `${key}=${value}`]);

    mkdirSync(path.join(work, 'bin'));
    const requireFromEngine = createRequire(path.join(REPO, 'packages/ffmpeg-video-composer/package.json'));
    symlinkSync(requireFromEngine('ffmpeg-static') as string, path.join(work, 'bin/ffmpeg'));
    const env = { ...process.env, PATH: `${path.join(work, 'bin')}:${process.env.PATH ?? ''}` };

    execFileSync('node', [CLI, 'validate', 'template.json'], { cwd: work, stdio: 'inherit', env });
    execFileSync(
      'node',
      [CLI, 'render', 'template.json', ...clipArgs, ...fieldArgs, '--locale', locale, '--output', out, '--quiet'],
      { cwd: work, stdio: 'inherit', env }
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
};

/** Cut `seconds` of `source` from `from` into a clean h264 clip (no audio). */
export const cutClip = (source: string, from: number, seconds: number, out: string): void => {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-ss',
    String(from),
    '-t',
    String(seconds),
    '-i',
    source,
    '-c:v',
    'libx264',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    '-an',
    out,
  ]);
};
