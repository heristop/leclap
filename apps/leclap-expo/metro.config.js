// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tests are co-located next to source (jest discovers them via its `roots`), but expo-router
// globs EVERY *.ts/*.tsx under `app/` as a route via require.context. The default blockList already
// ignores `__tests__/` dirs but NOT co-located `*.test.ts` files — so without this a co-located
// test gets bundled as a "route" and its top-level describe() crashes the app at runtime
// ("Property 'describe' doesn't exist"). blockList drops these files from Metro's file map, so
// require.context never sees them and they never enter the app bundle.
const existing = config.resolver.blockList;
const blockList = Array.isArray(existing) ? existing : [];
config.resolver.blockList = [...blockList, /.*\.(test|spec)\.[jt]sx?$/];

// Animated PNG overlays (.apng) aren't a default Metro asset extension, so require() them as assets
// (bundled for staging on-device + used as picker thumbnails).
if (!config.resolver.assetExts.includes('apng')) {
  config.resolver.assetExts = [...config.resolver.assetExts, 'apng'];
}

// The internal @leclap/* packages publish only an `exports` map and no `main` (e.g.
// @leclap/creative-kit -> ./src/index.ts), and the app imports several subpaths
// (@leclap/creative-kit/editor, /fonts, /media, …). Metro must honor package exports to resolve
// them; without this it falls back to a non-existent `main` and throws UnableToResolveError.
config.resolver.unstable_enablePackageExports = true;

// NOTE: no Node-module shims are needed. The reused core is cleanly split behind its platform
// abstractions, so the React-Native entry (`ffmpeg-video-composer/src/reactnative.ts`) pulls only
// Hermes-safe deps (tsyringe, zod, expo-file-system) — verified by tracing its import graph. If a
// future core change leaks a Node import into the RN graph, fix it at the source (move it behind the
// adapter seam) rather than shimming it here.

module.exports = config;
