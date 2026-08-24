// Metro babel transformer that runs React Compiler through Oxc's Rust port
// (`oxc-transform-react`) instead of `babel-plugin-react-compiler`, then hands the result to Expo's
// stock transformer for everything else (Flow/TS in node_modules, the RN JSX runtime, Fast Refresh,
// Reanimated worklets, the Hermes-targeted lowering).
//
// Running the compiler first is what upstream recommends, and it is required here: the worklets
// plugin rewrites function bodies, so it has to see already-memoized output rather than the reverse.
//
// `jsx: 'preserve'` leaves JSX for babel-preset-expo, which is the only pass that knows the platform
// (native vs. react-native-web) and the dev-time `__source` wiring. Oxc still strips TypeScript on
// the way through; that is fine for app sources, which carry no decorators, and is the reason this
// only runs over `app/` and `src/` — `packages/ffmpeg-video-composer` reaches the bundle through
// node_modules and does use decorators.
const path = require('node:path');
const upstream = require('@expo/metro-config/babel-transformer');
const { transformSync } = require('oxc-transform-react');
const { version } = require('oxc-transform-react/package.json');

const projectRoot = path.resolve(__dirname, '..');
const compiledDirs = [path.join(projectRoot, 'app'), path.join(projectRoot, 'src')].map((dir) => dir + path.sep);

// React Compiler infers components and hooks, so plain `.ts` modules are in scope too.
const SOURCE_FILE = /\.[jt]sx?$/;

const reactCompiler = {
  environment: {
    // Teaches the compiler about `SharedValue`/`useAnimatedStyle` so it stops treating a shared
    // value's `.value` write as a mutation it has to bail out on.
    enableCustomTypeDefinitionForReanimated: true,
  },
};

function shouldCompile(filename) {
  // Metro passes project-relative paths; resolve so the prefix test below is comparing like for like.
  const file = path.resolve(projectRoot, filename);

  if (!SOURCE_FILE.test(file)) {
    return false;
  }

  return compiledDirs.some((dir) => file.startsWith(dir));
}

module.exports = {
  ...upstream,

  transform(args) {
    if (!shouldCompile(args.filename)) {
      return upstream.transform(args);
    }

    const result = transformSync(args.filename, args.src, { jsx: 'preserve', reactCompiler });

    if (result.fatal) {
      const detail = result.errors.map((error) => error.codeframe ?? error.message).join('\n\n');

      throw new Error(`React Compiler could not transform ${args.filename}\n\n${detail}`);
    }

    // Non-fatal entries are bail-outs — the compiler declined to memoize a function and left it as
    // written. That is normal, so they stay silent instead of flooding every Metro rebuild.
    return upstream.transform({ ...args, src: result.code });
  },

  // Metro caches transform output keyed on this. Fold in the Oxc version so a dependency bump
  // invalidates the cache; without it a `pnpm update` would keep serving stale compiled modules.
  getCacheKey(options) {
    return `${upstream.getCacheKey(options)}$oxc-transform-react@${version}`;
  },
};
