// Keeps `bundle()` working on TypeScript 7.
//
// @remotion/bundler 4.0.509's esbuild loader reads tsconfig.json through `ts.readConfigFile` /
// `ts.sys`. TypeScript 7's native rewrite dropped both, so the moment the loader sees a resolvable
// `typescript` it crashes every render script in this package with
//   TypeError: Cannot read properties of undefined (reading 'readFile')
// The loader only reaches for TypeScript when it has not been handed a `tsconfigRaw`, so hand it one.
// esbuild needs nothing else from this package's tsconfig — it transpiles per-file and type-checking
// is `pnpm --filter @leclap/brand-motion typecheck`'s job, not the bundler's.
//
// Delete this the day @remotion/bundler stops calling the removed API.
import type { WebpackConfiguration, WebpackOverrideFn } from '@remotion/bundler';

type Rules = NonNullable<NonNullable<WebpackConfiguration['module']>['rules']>;
type Rule = Rules[number];
type Use = Extract<NonNullable<Extract<Rule, { use?: unknown }>['use']>, readonly unknown[]>[number];

/** Mirrors the `jsx` setting in tsconfig.json — the only compiler option esbuild acts on here. */
const TSCONFIG_RAW = { compilerOptions: { jsx: 'react-jsx' } };

// Narrowed inline rather than behind a type predicate: `Use` is a union that includes bare strings,
// and an `x is Use & {...}` predicate keeps `string & {...}` in the union, which is not spreadable.
const withTsconfigRaw = (use: Use): Use => {
  if (typeof use !== 'object' || use === null) return use;

  if (!('loader' in use) || typeof use.loader !== 'string' || !use.loader.includes('esbuild-loader')) return use;

  // `options` is typed `string | Record<string, unknown> | undefined`; only the record form can be
  // extended, and the loader Remotion registers always uses it.
  const existing = 'options' in use && typeof use.options === 'object' ? use.options : {};

  return { ...use, options: { ...existing, tsconfigRaw: TSCONFIG_RAW } };
};

const patchRule = (rule: Rule): Rule => {
  if (typeof rule !== 'object' || rule === null) return rule;

  if (!('use' in rule) || !Array.isArray(rule.use)) return rule;

  return { ...rule, use: rule.use.map(withTsconfigRaw) };
};

export const webpackOverride: WebpackOverrideFn = (config) => {
  const rules = config.module?.rules;

  if (!rules) return config;

  return { ...config, module: { ...config.module, rules: rules.map(patchRule) } };
};
