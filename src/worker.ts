import { SUPABASE_URL, SUPABASE_KEY, IMAGE_BUCKET } from './cms/config';
import { cleanContent, contactHref, dateLabel, mediaPattern, type Content } from './cms/content';
import { customSlugPattern, customWork, customWorks, workCardHTML, workTemplatePath } from './cms/works';

interface Env { ASSETS: { fetch(request: Request): Promise<Response> } }
interface Context { waitUntil(promise: Promise<unknown>): void }

async function publishedContent(origin: string, ctx: Context): Promise<Content> {
  const cache = caches.default;
  const key = new Request(origin + '/__offpat-last-published');
  try {
    const response = await fetch(SUPABASE_URL + '/rest/v1/offpat_content?id=eq.published&select=content', {
      headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Content read failed');
    const rows = await response.json() as { content: unknown }[];
    if (!rows.length) throw new Error('Published content missing');
    const content = cleanContent(rows[0].content);
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(content), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400' },
    })));
    return content;
  } catch {
    // Preserve the most recent published copy through a temporary database outage.
    const last = await cache.match(key);
    return last ? cleanContent(await last.json()) : {};
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    if (url.pathname.startsWith('/media/')) {
      if (!mediaPattern.test(url.pathname)) return new Response('Not found', { status: 404 });
      const object = 'editor/' + url.pathname.slice('/media/'.length);
      // Storage RLS exposes only files referenced by published content.
      const result = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${object}`, {
        method: request.method, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
      return new Response(result.body, { headers: {
        'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
      } });
    }
    const pathname = url.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    const editorPreview = url.searchParams.get('editor-preview') === '1';
    const slug = pathname.match(/^\/gallery\/([a-z0-9-]+)$/)?.[1];
    const dynamicDetail = !!slug && customSlugPattern.test(slug);
    // This empty shell contains no saved content; only the signed-in editor overlays drafts.
    if (pathname === workTemplatePath && !editorPreview) return new Response('Not found', { status: 404 });
    let content: Content | undefined;
    if (dynamicDetail) {
      content = await publishedContent(url.origin, ctx);
      if (!customWork(content, slug!)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    const headers = new Headers(request.headers);
    headers.delete('if-none-match'); headers.delete('if-modified-since');
    const assetURL = new URL(request.url);
    if (dynamicDetail) { assetURL.pathname = workTemplatePath; assetURL.search = ''; }
    const asset = await env.ASSETS.fetch(new Request(assetURL, { method: request.method, headers }));
    if (!asset.headers.get('Content-Type')?.includes('text/html') || asset.status !== 200) return asset;
    const response = new Response(asset.body, asset);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.delete('ETag'); response.headers.delete('Last-Modified');
    response.headers.delete('Content-Length');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    if (pathname === '/admin') {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
      return response;
    }
    if (editorPreview && !dynamicDetail) {
      // This is only the public, built baseline. Drafts are never sent here.
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
    content ??= await publishedContent(url.origin, ctx);
    const values = content;
    const contentKey = (key: string) => dynamicDetail ? key.replace(/^piece\.template\./, `piece.${slug}.`) : key;
    const rewriter = new HTMLRewriter()
      .on('[data-works-grid]', { element(el) {
        for (const work of customWorks(values)) el.append(workCardHTML(work), { html: true });
      } })
      .on('[data-edit]', { element(el) {
        const key = contentKey(el.getAttribute('data-edit')!);
        el.setAttribute('data-edit', key);
        const value = values[key];
        if (!value || value.type === 'image') return;
        el.setInnerContent(value.type === 'date' ? dateLabel(value.value) : value.value);
        el.setAttribute('style', (el.getAttribute('style') ?? '') + ';white-space:pre-line');
        if (value.type === 'date') el.setAttribute('datetime', value.value);
        const href = contactHref(el.getAttribute('data-edit-format'), value.value);
        if (href) el.setAttribute('href', href);
      } })
      .on('[data-edit-contact]', { element(el) {
        const value = values[el.getAttribute('data-edit-contact')!];
        if (!value || value.type !== 'text') return;
        const href = contactHref(el.getAttribute('data-edit-format'), value.value);
        if (href) el.setAttribute('href', href);
      } })
      .on('[data-edit-image]', { element(el) {
        const key = contentKey(el.getAttribute('data-edit-image')!);
        el.setAttribute('data-edit-image', key);
        const value = values[key];
        if (value?.type === 'image') {
          el.setAttribute('src', value.src); el.setAttribute('alt', value.alt);
          el.setAttribute('width', String(value.width)); el.setAttribute('height', String(value.height));
          if (value.thumbnail) el.setAttribute('srcset', `${value.thumbnail} ${value.thumbnailWidth}w, ${value.src} ${value.width}w`);
          else el.removeAttribute('srcset');
        }
        const alt = values[key + '.alt'];
        if (alt?.type === 'text') el.setAttribute('alt', alt.value);
      } })
      .on('[data-edit-image-link]', { element(el) {
        const value = values[contentKey(el.getAttribute('data-edit-image-link')!)];
        if (value?.type === 'image') el.setAttribute('href', value.src);
      } })
      .on('[data-event-end-key]', { element(el) {
        const value = values[el.getAttribute('data-event-end-key')!];
        if (value?.type === 'date') el.setAttribute('data-event-end', value.value);
      } });
    if (dynamicDetail) rewriter.on('meta[name="robots"]', { element(el) { el.remove(); } });
    if (slug) {
      const title = values[`piece.${slug}.title`];
      const description = values[`piece.${slug}.description`];
      if (title?.type === 'text') rewriter.on('title', { element(el) { el.setInnerContent(title.value + ' — Off-Pat Ceramics'); } });
      if (description?.type === 'text') rewriter.on('meta[name="description"]', { element(el) { el.setAttribute('content', description.value); } });
    }
    return rewriter.transform(response);
  },
};
