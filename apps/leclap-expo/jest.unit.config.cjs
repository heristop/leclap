/**
 * Self-contained unit-test config for pure domain/logic modules.
 *
 * Uses @swc/jest (SWC transpiler) rather than the jest-expo preset: these tests cover
 * framework-independent logic (value objects, mappers, use cases, pure helpers) and must run
 * without the React Native / babel-preset-expo transform stack. Component/RN tests, if added
 * later, belong under the default `jest-expo` config (the `test` script).
 *
 * SWC transpiles each file independently (no cross-file type-checking), so unrelated type
 * errors elsewhere in the app never block these unit tests — repo-wide type safety is enforced
 * by `vp check` / `tsc --noEmit`. SWC (not ts-jest) is used because TypeScript 7's native
 * compiler exposes no programmatic API, which ts-jest requires (its peer range stops at <7).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/app'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Coverage is scoped to the framework-independent logic these tests target. RN/Expo
  // components are out of scope here (they need the jest-expo transform, not this one).
  collectCoverageFrom: [
    'src/domain/entities/**/*.ts',
    'src/domain/valueObjects/**/*.ts',
    'src/application/usecases/**/*.ts',
    'src/presentation/mappers/**/*.ts',
    'app/features/editor/preview/previewHelpers.ts',
    '!**/*.test.ts',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          // Pinned (not 'esnext') so an SWC upgrade can't silently change how these tests are
          // transpiled. ES2024 is what the previous ts-jest tsconfig targeted, and Node 24 runs
          // it without downleveling anything that matters.
          target: 'es2024',
          parser: { syntax: 'typescript', tsx: true, decorators: true },
          // Match the prior ts-jest setup (experimentalDecorators + emitDecoratorMetadata) so
          // tsyringe-style decorators in transitively imported modules keep working. `react.runtime`
          // replaces the deleted tsconfig's `"jsx": "react-jsx"`: SWC otherwise defaults to the
          // classic runtime and emits bare `React.createElement`, so the first unit test that reaches
          // any .tsx through an import chain would die with "React is not defined".
          transform: { legacyDecorator: true, decoratorMetadata: true, react: { runtime: 'automatic' } },
        },
      },
    ],
  },
};
