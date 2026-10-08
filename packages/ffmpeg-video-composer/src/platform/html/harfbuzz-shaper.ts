// Stands in for `harfbuzzjs` in browser bundles (the engine's browser build and the web app alias Satori's
// `import … from "harfbuzzjs"` here). The package's own entry starts HarfBuzz the moment it is imported and
// fetches `hb.wasm` next to the page, which no page serves; this one waits for the bytes the host's loader
// fetched (provideHarfbuzzShaper, called by the browser rasteriser) and starts the same build from them.
import createHarfBuzz from 'harfbuzzjs/hb.js';
import hbjs from 'harfbuzzjs/hbjs.js';

const { promise: wasmBinary, resolve: provide } = Promise.withResolvers<BufferSource>();

/** Hands HarfBuzz's shaping build to Satori; only the first call counts. */
export function provideHarfbuzzShaper(wasm: BufferSource): void {
  provide(wasm);
}

/** What `harfbuzzjs` resolves to: the hbjs API over a started HarfBuzz. */
const shaper: Promise<ReturnType<typeof hbjs>> = wasmBinary.then(async (binary) =>
  hbjs(await createHarfBuzz({ wasmBinary: binary }))
);

export default shaper;
