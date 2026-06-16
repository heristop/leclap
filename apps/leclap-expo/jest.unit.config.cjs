/**
 * Self-contained unit-test config for pure domain/logic modules.
 *
 * Uses ts-jest (TypeScript compiler) rather than the jest-expo preset: these tests cover
 * framework-independent logic (value objects, mappers, use cases, pure helpers) and must run
 * without the React Native / babel-preset-expo transform stack. Component/RN tests, if added
 * later, belong under the default `jest-expo` config (the `test` script).
 *
 * `isolatedModules` transpiles each file independently (no cross-file type-checking), so
 * unrelated type errors elsewhere in the app never block these unit tests.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/app'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Coverage is scoped to the framework-independent logic these tests target. RN/Expo
  // components are out of scope here (they need the jest-expo transform, not ts-jest).
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
      'ts-jest',
      {
        // Standalone tsconfig (does NOT extend the app's tsconfig.json) to avoid inheriting
        // rootDir/outDir/composite settings that conflict with ts-jest's per-file transpile.
        // isolatedModules is set inside that tsconfig.
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
};
