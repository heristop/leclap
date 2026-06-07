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

module.exports = config;
