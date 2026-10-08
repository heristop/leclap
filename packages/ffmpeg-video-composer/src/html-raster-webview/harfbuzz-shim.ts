// Satori shapes text with harfbuzzjs, whose entry loads hb.wasm from beside its script: nothing to fetch
// inside the WebView. The page build aliases `harfbuzzjs` to this module, which hands the inlined bytes over.

import createHarfBuzz from 'harfbuzzjs/hb.js';
import hbjs from 'harfbuzzjs/hbjs.js';
import { pageWasm } from './page-wasm';

export default createHarfBuzz({ wasmBinary: pageWasm('shape') }).then(hbjs);
