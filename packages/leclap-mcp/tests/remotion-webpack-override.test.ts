import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as OverrideModule from '../src/tools/remotion-webpack-override.js';

// The probe reads whatever `typescript` resolves to, so each case swaps that module and re-imports
// the subject: the repo itself is on TypeScript 7, and a test that only exercised the ambient
// version would silently stop covering the guard the day the repo moves off it.
async function loadWith(typescriptModule: () => Record<string, unknown>): Promise<typeof OverrideModule> {
  vi.resetModules();
  vi.doMock('typescript', typescriptModule);

  return import('../src/tools/remotion-webpack-override.js');
}

// Shaped like the real thing: TypeScript is CJS, so the namespace carries a `default`. 7.0.2's
// exposes neither `sys` nor `readConfigFile`; every earlier major exposes both.
const typescript7 = () => ({ default: { version: '7.0.2' } });
const typescript6 = () => ({ default: { sys: { readFile: () => '' }, readConfigFile: () => ({ config: {} }) } });
const noTypescript = () => {
  throw new Error("Cannot find module 'typescript'");
};

afterEach(() => {
  vi.doUnmock('typescript');
  vi.resetModules();
});

describe('remotionBundleOptions', () => {
  it('carries the webpack override when TypeScript has dropped the config API', async () => {
    const { remotionBundleOptions, webpackOverride } = await loadWith(typescript7);

    expect(await remotionBundleOptions('/proj/src/index.ts')).toEqual({
      entryPoint: '/proj/src/index.ts',
      webpackOverride,
    });
  });

  it('leaves the consumer bundle untouched when TypeScript still exposes the config API', async () => {
    const { remotionBundleOptions } = await loadWith(typescript6);

    expect(await remotionBundleOptions('/proj/src/index.ts')).toEqual({ entryPoint: '/proj/src/index.ts' });
  });

  it('leaves the consumer bundle untouched when TypeScript does not resolve at all', async () => {
    const { remotionBundleOptions } = await loadWith(noTypescript);

    expect(await remotionBundleOptions('/proj/src/index.ts')).toEqual({ entryPoint: '/proj/src/index.ts' });
  });
});

describe('webpackOverride', () => {
  const run = async (config: unknown): Promise<Record<string, unknown>> => {
    const { webpackOverride } = await loadWith(typescript7);

    return webpackOverride(config as never) as Record<string, unknown>;
  };

  it('hands the esbuild loader a tsconfigRaw so it never reads tsconfig.json', async () => {
    const patched = await run({
      module: {
        rules: [{ test: /\.tsx?$/, use: [{ loader: '/n_m/esbuild-loader/index.js', options: { target: 'es2020' } }] }],
      },
    });

    const [rule] = (patched.module as { rules: { use: { options: Record<string, unknown> }[] }[] }).rules;

    expect(rule.use[0].options).toEqual({
      target: 'es2020',
      tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
    });
  });

  it('leaves other loaders and rule shapes alone', async () => {
    const rules = [
      { test: /\.css$/, use: [{ loader: 'css-loader', options: { modules: true } }] },
      { test: /\.png$/, type: 'asset/resource' },
    ];

    const patched = await run({ module: { rules } });

    expect((patched.module as { rules: unknown[] }).rules).toEqual(rules);
  });

  it('returns the config untouched when it declares no module rules', async () => {
    const config = { output: { path: '/out' } };

    expect(await run(config)).toEqual(config);
  });
});
