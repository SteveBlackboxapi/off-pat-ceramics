import { SUPABASE_URL, SUPABASE_KEY, IMAGE_BUCKET } from './cms/config';
import { cleanContent, contactHref, dateLabel, mediaPattern, type Content } from './cms/content';

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
    const headers = new Headers(request.headers);
    headers.delete('if-none-match'); headers.delete('if-modified-since');
    const asset = await env.ASSETS.fetch(new Request(request, { headers }));
    if (!asset.headers.get('Content-Type')?.includes('text/html') || asset.status !== 200) return asset;
    const response = new Response(asset.body, asset);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.delete('ETag'); response.headers.delete('Last-Modified');
    response.headers.delete('Content-Length');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    if (url.pathname.replace(/\/$/, '') === '/admin') {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
      return response;
    }
    if (url.searchParams.get('editor-preview') === '1') {
      // This is only the public, built baseline. Drafts are never sent here.
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
    const content = await publishedContent(url.origin, ctx);
    const rewriter = new HTMLRewriter()
      .on('[data-edit]', { element(el) {
        const value = content[el.getAttribute('data-edit')!];
        if (!value || value.type === 'image') return;
        el.setInnerContent(value.type === 'date' ? dateLabel(value.value) : value.value);
        el.setAttribute('style', (el.getAttribute('style') ?? '') + ';white-space:pre-line');
        if (value.type === 'date') el.setAttribute('datetime', value.value);
        const href = contactHref(el.getAttribute('data-edit-format'), value.value);
        if (href) el.setAttribute('href', href);
      } })
      .on('[data-edit-contact]', { element(el) {
        const value = content[el.getAttribute('data-edit-contact')!];
        if (!value || value.type !== 'text') return;
        const href = contactHref(el.getAttribute('data-edit-format'), value.value);
        if (href) el.setAttribute('href', href);
      } })
      .on('[data-edit-image]', { element(el) {
        const key = el.getAttribute('data-edit-image')!;
        const value = content[key];
        if (value?.type === 'image') {
          el.setAttribute('src', value.src); el.setAttribute('alt', value.alt);
          el.setAttribute('width', String(value.width)); el.setAttribute('height', String(value.height));
          if (value.thumbnail) el.setAttribute('srcset', `${value.thumbnail} ${value.thumbnailWidth}w, ${value.src} ${value.width}w`);
          else el.removeAttribute('srcset');
        }
        const alt = content[key + '.alt'];
        if (alt?.type === 'text') el.setAttribute('alt', alt.value);
      } })
      .on('[data-edit-image-link]', { element(el) {
        const value = content[el.getAttribute('data-edit-image-link')!];
        if (value?.type === 'image') el.setAttribute('href', value.src);
      } })
      .on('[data-event-end-key]', { element(el) {
        const value = content[el.getAttribute('data-event-end-key')!];
        if (value?.type === 'date') el.setAttribute('data-event-end', value.value);
      } });
    const slug = url.pathname.match(/^\/gallery\/([a-z0-9-]+)\/?$/)?.[1];
    if (slug) {
      const title = content[`piece.${slug}.title`];
      const description = content[`piece.${slug}.description`];
      if (title?.type === 'text') rewriter.on('title', { element(el) { el.setInnerContent(title.value + ' — Off-Pat Ceramics'); } });
      if (description?.type === 'text') rewriter.on('meta[name="description"]', { element(el) { el.setAttribute('content', description.value); } });
    }
    return rewriter.transform(response);
  },
};
