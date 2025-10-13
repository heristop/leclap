const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'coverage/',
      'android/',
      'ios/',
      'web-build/',
      '*.config.js',
      '*.config.ts',
      'babel.config.js',
      'metro.config.js',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // Include both app and src directories
      // The src directory should be linted by default
    },
  },
];