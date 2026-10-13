import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { addWork, removeWork } from '../src/cms/works.ts';
import type { Content } from '../src/cms/content.ts';

test('published gallery and detail routes follow the draft lifecycle without exposing draft content', async t => {
  const slug = 'work-12345678-1234-4234-9234-123456789abc';
  const title = 'Tide <script>alert("test")</script> & clay';
  const original: Content = { 'piece.crackle-bowl.title': { type: 'text', value: 'Tidal Bowl' } };
  const draft = addWork(original, { slug, title, kind: 'Bowl', description: 'Handmade <b>clay</b>.',
    image: { type: 'image', src: '/media/12345678-1234-4234-9234-123456789abc.webp', alt: 'Clay " onerror="alert(1)', width: 1600, height: 1200 } });
  let published: Content = original;
  const reads: string[] = [];
  const { outputFiles } = await build({ entryPoints: ['src/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  const mf = new Miniflare(convertV4MiniflareOptions({ name: 'site', modules: true, script: outputFiles[0].text, compatibilityDate: '2026-10-12',
    outboundService: request => {
      const url = new URL(request.url); reads.push(url.pathname + url.search);
      assert.equal(url.searchParams.get('id'), 'eq.published');
      return Response.json([{ content: published }]);
    },
    serviceBindings: { ASSETS: async request => {
      const path = new URL(request.url).pathname.replace(/\/$/, '') || '';
      try { return new Response(await readFile(`dist${path}/index.html`), { headers: { 'Content-Type': 'text/html' } }); }
      catch { return new Response('Not found', { status: 404 }); }
    } },
  }));
  t.after(() => mf.dispose());
  const get = (path: string) => mf.dispatchFetch('https://offpat.test' + path);
  let response = await get('/gallery');
  let html = await response.text();
  assert.match(html, /Tidal Bowl/);
  assert.doesNotMatch(html, /data-custom-work|Add work/);
  assert.equal((await get('/gallery/' + slug)).status, 404);
  assert.equal((await get('/gallery/' + slug + '?editor-preview=1')).status, 404);
  assert.equal((await get('/work-template')).status, 404);
  const baseline = await get('/work-template?editor-preview=1');
  assert.equal(baseline.status, 200);
  assert.match(baseline.headers.get('X-Robots-Tag')!, /noindex/);
  assert.doesNotMatch(await baseline.text(), /Tidal Bowl|data-custom-work/);

  published = structuredClone(draft);
  response = await get('/gallery'); html = await response.text();
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(html, new RegExp(`href="/gallery/${slug}"`));
  assert.match(html, /Tide &lt;script&gt;/);
  assert.match(html, /alt="Clay &quot; onerror=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /<script>alert|Add work/);
  assert.equal((html.match(/class="work-card"/g) ?? []).length, 7);
  const detail = await get('/gallery/' + slug);
  html = await detail.text();
  assert.equal(detail.status, 200);
  assert.match(html, /<title>Tide &lt;script&gt;/);
  assert.match(html, /Handmade &lt;b&gt;clay&lt;\/b&gt;/);
  assert.match(html, new RegExp(`data-edit="piece\.${slug}\.title"`));
  assert.match(html, /src="\/media\/12345678-1234-4234-9234-123456789abc.webp"/);
  assert.doesNotMatch(html, /name="robots"|piece\.template\./);

  const edited = structuredClone(draft);
  edited[`piece.${slug}.title`] = { type: 'text', value: 'Private revised name' };
  assert.doesNotMatch(await (await get('/gallery/' + slug)).text(), /Private revised name/);
  published = edited;
  assert.match(await (await get('/gallery/' + slug)).text(), /Private revised name/);
  published = removeWork(published, slug);
  assert.equal((await get('/gallery/' + slug)).status, 404);
  assert.doesNotMatch(await (await get('/gallery')).text(), /data-custom-work/);
  assert.match(await (await get('/gallery/crackle-bowl')).text(), /Tidal Bowl/);
  assert.ok(reads.length > 0 && reads.every(path => path.includes('id=eq.published')));
});
