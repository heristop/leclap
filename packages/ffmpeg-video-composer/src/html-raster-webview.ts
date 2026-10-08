// The page the phone draws HTML layers in: a hidden react-native-webview (Hermes has no WebAssembly) runs
// the shared Satori + resvg + HarfBuzz pipeline over the WebAssembly inlined in this page
// (dist/html-rasteriser.html, assembled by tsdown.config.ts). Messages are raster-messages.ts JSON:
// requests arrive through the WebView's postMessage, replies leave through window.ReactNativeWebView.

import satori from 'satori';
import * as resvg from '@resvg/resvg-wasm';
import type { HbSubset } from './core/html/font-instances';
import { createRasterPage } from './core/html/raster-page';
import { createSatoriRasteriser, HTML_RENDERER_VERSION, type RasterEngines } from './core/html/satori-raster';
import type { RasterPageReply } from './core/html/raster-messages';
import { pageWasm } from './html-raster-webview/page-wasm';

interface PageGlobals {
  ReactNativeWebView?: { postMessage(text: string): void };
}

const page = globalThis as unknown as PageGlobals & Window;

function post(text: string): void {
  if (page.ReactNativeWebView) {
    page.ReactNativeWebView.postMessage(text);

    return;
  }

  // Outside the app (a desktop browser checking the bundle): answer the opener or the parent frame.
  (page.opener ?? page.parent).postMessage(text, '*');
}

async function loadEngines(): Promise<RasterEngines> {
  await resvg.initWasm(pageWasm('resvg'));
  const hb = await WebAssembly.instantiate(pageWasm('subset'));

  return { satori, resvg, hb: hb.instance.exports as unknown as HbSubset };
}

const engines = loadEngines();
const handle = createRasterPage(
  createSatoriRasteriser(() => engines),
  post
);

function onMessage(event: Event): void {
  const { data } = event as MessageEvent<unknown>;

  if (typeof data !== 'string') return;

  handle(data).catch(() => null);
}

// iOS delivers the WebView's postMessage on window, Android on document.
page.addEventListener('message', onMessage);
document.addEventListener('message', onMessage);

engines.then(
  () => {
    post(JSON.stringify({ type: 'ready', version: HTML_RENDERER_VERSION } satisfies RasterPageReply));
  },
  (error: unknown) => {
    post(JSON.stringify({ type: 'failed', message: String(error) } satisfies RasterPageReply));
  }
);
