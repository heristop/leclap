// The on-device check of HTML layers (leclap://ffmpeg-spike?check=html): compiles the html-card sample, two
// layers drawn in the hidden WebView, and reports each layer's time and whether its PNG is byte-identical
// to the one Node draws (packages/ffmpeg-video-composer/tests/html-card-sample.test.ts holds the same hashes).

import { sha256Hex } from 'ffmpeg-video-composer/src/core/determinism/sha256.ts';
import htmlCard from '../../../../../examples/motion-design/html-card.json';
import { compileOnDevice } from './compileOnDevice';
import { htmlRasterHost } from './html-raster/html-raster-host';

/** Node's PNG of each html-card layer, by box size. */
export const HTML_CARD_GOLDENS: Readonly<Record<string, string>> = {
  '560×300': '5e64ed98e22e31b55768083d183010ea40b3f0a407f29aad5eae876fd7107e5b',
  '300×120': '506c9036f95d8fe5267ebedde0f8be3e05eb5845238b0a3ac6403b775f033485',
};

export interface CheckedLayer {
  size: string;
  ms: number;
  pageMs: number;
  /** Byte-identical to Node's PNG of the same layer. */
  golden: boolean;
}

export interface HtmlLayerCheck {
  outputUri: string;
  /** Mount to `ready` of the WebView page. */
  pageLoadMs: number | null;
  layers: CheckedLayer[];
}

export async function runHtmlLayerCheck(append: (line: string) => void): Promise<HtmlLayerCheck> {
  const hashes: { size: string; sha: string }[] = [];
  const stop = htmlRasterHost.observe((request, raster) => {
    hashes.push({ size: `${request.width}×${request.height}`, sha: sha256Hex(raster.png) });
  });
  const before = htmlRasterHost.timings().length;

  append('Compiling the html-card sample (two HTML layers drawn in the hidden WebView)…');

  try {
    const result = await compileOnDevice(structuredClone(htmlCard), {}, { qualityTier: 'draft' });

    if (!result.success || !result.outputUri) throw new Error(result.error ?? 'HTML layer compile produced no output');

    const timings = htmlRasterHost.timings().slice(before);
    const layers = hashes.map(({ size, sha }, index) => ({
      size,
      ms: timings[index]?.ms ?? 0,
      pageMs: timings[index]?.pageMs ?? 0,
      golden: HTML_CARD_GOLDENS[size] === sha,
    }));
    const check = { outputUri: result.outputUri, pageLoadMs: htmlRasterHost.pageLoadMs(), layers };

    append(`Page ready in ${check.pageLoadMs ?? '?'} ms`);

    for (const layer of layers) {
      const verdict = layer.golden ? '✅ same bytes as Node' : '❌ differs from Node';
      append(`${layer.size}: ${layer.ms} ms (page ${layer.pageMs} ms) ${verdict}`);
    }

    console.info('[html-layer-check]', JSON.stringify(check));

    return check;
  } finally {
    stop();
  }
}
