import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { init } from '@jsquash/webp/encode.js';
import { simd } from 'wasm-feature-detect';
import { canvasWebp } from '../src/cms/image-encoding.ts';

test('keeps native WebP without reading pixels', async () => {
  const blob = new Blob(['native'], { type: 'image/webp' });
  const canvas = { toBlob: (done: (blob: Blob) => void) => done(blob) } as HTMLCanvasElement;
  assert.equal(await canvasWebp(canvas), blob);
});

test('Safari PNG fallback produces actual WebP bytes, including a null native result', async () => {
  const filename = await simd() ? 'webp_enc_simd.wasm' : 'webp_enc.wasm';
  await init({ wasmBinary: await readFile(new URL(`../node_modules/@jsquash/webp/codec/enc/${filename}`, import.meta.url)) });
  for (const native of [new Blob(['PNG'], { type: 'image/png' }), null]) {
    const canvas = {
      width: 2, height: 2,
      toBlob: (done: (blob: Blob | null) => void) => done(native),
      getContext: () => ({ getImageData: () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) }) }),
    } as unknown as HTMLCanvasElement;
    const result = await canvasWebp(canvas);
    const bytes = Buffer.from(await result.arrayBuffer());
    assert.equal(result.type, 'image/webp');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});
