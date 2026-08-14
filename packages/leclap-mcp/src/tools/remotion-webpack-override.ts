// Keeps `render_remotion_clip`'s `bundle()` working when the consumer is on TypeScript 7.
//
// @remotion/bundler's esbuild loader reads the project's tsconfig.json through `ts.readConfigFile` /
// `ts.sys`. TypeScript 7's native rewrite dropped both, so `bundle()` dies with
//   TypeError: Cannot read properties of undefined (reading 'readFile')
// before it ever reaches the consumer's composition. The loader only reaches for TypeScript when it
// has not been handed a `tsconfigRaw`, so hand it one.
//
// Unlike the copy in packages/leclap-brand-motion (which serves this repo's own fixed compositions),
// this is a published package bundling somebody else's Remotion project, so the workaround is gated
// on the crash actually being possible: a `tsconfigRaw` REPLACES the compiler options esbuild would
// otherwise have read from their tsconfig (jsxImportSource, experimentalDecorators, target, …), and
// must not fire for the majority whose renders work today.
//
// Delete this the day @remotion/bundler stops calling the removed API.
import type { WebpackConfiguration, WebpackOverrideFn } from '@remotion/bundler';

type Rules = NonNullable<NonNullable<WebpackConfiguration['module']>['rules']>;
type Rule = Rules[number];
type Use = Extract<NonNullable<Extract<Rule, { use?: unknown }>['use']>, readonly unknown[]>[number];

// The automatic JSX runtime, which is what Remotion's own templates set and what its compositions
// are written against. It is the only compiler option esbuild acts on here — esbuild transpiles
// per-file, and type-checking stays the consumer's own `tsc`'s job, not the bundler's.
const TSCONFIG_RAW = { compilerOptions: { jsx: 'react-jsx' } };

// Narrowed inline rather than behind a type predicate: `Use` is a union that includes bare strings,
// and an `x is Use & {...}` predicate keeps `string & {...}` in the union, which is not spreadable.
function withTsconfigRaw(use: Use): Use {
  if (typeof use !== 'object' || use === null) return use;

  if (!('loader' in use) || typeof use.loader !== 'string' || !use.loader.includes('esbuild-loader')) return use;

  // `options` is typed `string | Record<string, unknown> | undefined`; only the record form can be
  // extended, and the loader Remotion registers always uses it.
  const existing = 'options' in use && typeof use.options === 'object' ? use.options : {};

  return { ...use, options: { ...existing, tsconfigRaw: TSCONFIG_RAW } };
}

function patchRule(rule: Rule): Rule {
  if (typeof rule !== 'object' || rule === null) return rule;

  if (!('use' in rule) || !Array.isArray(rule.use)) return rule;

  return { ...rule, use: rule.use.map(withTsconfigRaw) };
}

export function webpackOverride(config: WebpackConfiguration): WebpackConfiguration {
  const rules = config.module?.rules;

  if (!rules) return config;

  return { ...config, module: { ...config.module, rules: rules.map(patchRule) } };
}

function hasConfigApi(candidate: unknown): boolean {
  if (typeof candidate !== 'object' || candidate === null) return false;

  const api = candidate as { sys?: unknown; readConfigFile?: unknown };

  return typeof api.readConfigFile === 'function' && Boolean(api.sys);
}

// Feature-detected rather than version-sniffed: what breaks the loader is the missing API, not a
// version number. Importing `typescript` is the same resolution the loader itself performs, so a
// project where it does not resolve is a project where the loader never reaches for it either.
// TypeScript is CJS, so the namespace's `default` is its whole `module.exports` — that is where the
// API lives when it exists at all; the namespace itself is only consulted if some future build ships
// pure ESM with no default.
async function typescriptDroppedConfigApi(): Promise<boolean> {
  try {
    const mod: object = await import('typescript');
    const exported = 'default' in mod ? mod.default : mod;

    return !hasConfigApi(exported);
  } catch {
    return false;
  }
}

/** `bundle()` options for the consumer's entry, carrying the TypeScript 7 workaround only if needed. */
export async function remotionBundleOptions(
  entryPoint: string
): Promise<{ entryPoint: string; webpackOverride?: WebpackOverrideFn }> {
  if (await typescriptDroppedConfigApi()) {
    return { entryPoint, webpackOverride };
  }

  return { entryPoint };
}
