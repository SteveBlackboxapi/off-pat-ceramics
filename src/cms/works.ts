import { validValue, type Content, type ImageValue } from './content.ts';

export const customSlugPattern = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const workTemplatePath = '/work-template';
export type AddedWork = { slug: string; title: string; kind: string; description: string; image: ImageValue };

function text(content: Content, key: string): string {
  const value = content[key];
  return value?.type === 'text' ? value.value : '';
}
export function customWorkSlugs(content: Content): string[] {
  return Object.keys(content).filter(key => key.startsWith('piece.') && key.endsWith('.entry'))
    .map(key => key.slice(6, -6))
    .filter(slug => customSlugPattern.test(slug) && !!text(content, `piece.${slug}.entry`))
    .sort((a, b) => text(content, `piece.${a}.entry`).localeCompare(text(content, `piece.${b}.entry`)) || a.localeCompare(b));
}
export function customWork(content: Content, slug: string): AddedWork | undefined {
  if (!customSlugPattern.test(slug) || !text(content, `piece.${slug}.entry`)) return;
  const prefix = `piece.${slug}.`, image = content[prefix + 'image'];
  const title = text(content, prefix + 'title');
  if (!title.trim() || image?.type !== 'image' || !validValue(image)) return;
  const alt = content[prefix + 'image.alt'];
  return { slug, title, kind: text(content, prefix + 'kind'), description: text(content, prefix + 'description'),
    image: { ...image, alt: alt?.type === 'text' ? alt.value : image.alt } };
}
export function customWorks(content: Content): AddedWork[] {
  return customWorkSlugs(content).flatMap(slug => { const work = customWork(content, slug); return work ? [work] : []; });
}
export function addWork(content: Content, work: AddedWork, createdAt = new Date().toISOString()): Content {
  if (!customSlugPattern.test(work.slug) || !work.title.trim() || !validValue(work.image)) throw new Error('Add a name and photograph for this piece.');
  const prefix = `piece.${work.slug}.`;
  return { ...content,
    [prefix + 'entry']: { type: 'text', value: createdAt },
    [prefix + 'title']: { type: 'text', value: work.title.trim() },
    [prefix + 'kind']: { type: 'text', value: work.kind.trim() },
    [prefix + 'description']: { type: 'text', value: work.description.trim() },
    [prefix + 'image']: work.image,
  };
}
export function removeWork(content: Content, slug: string): Content {
  if (!customSlugPattern.test(slug)) return content;
  return Object.fromEntries(Object.entries(content).filter(([key]) => !key.startsWith(`piece.${slug}.`)));
}
function escape(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
// The same card markup is used in the authenticated preview and public Worker.
// Every value is escaped; image paths have already passed content validation.
export const workArrowHTML = '<svg class="work-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg>';
export function workCardHTML(work: AddedWork, previewImage?: string): string {
  const prefix = `piece.${work.slug}.`, image = work.image;
  const src = previewImage ?? image.thumbnail ?? image.src;
  const srcset = !previewImage && image.thumbnail ? ` srcset="${image.thumbnail} ${image.thumbnailWidth}w, ${image.src} ${image.width}w"` : '';
  return `<a href="/gallery/${work.slug}" class="work-card" data-custom-work="${work.slug}">
    <img data-edit-image="${prefix}image" data-edit-label="${escape(work.title)} — photograph" src="${escape(src)}"${srcset} sizes="(min-width: 1280px) 584px, (min-width: 650px) 46vw, 90vw" alt="${escape(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">
    <div class="work-info"><p class="work-kind" data-edit="${prefix}kind" data-edit-label="${escape(work.title)} — category">${escape(work.kind)}</p>
    <h2><span data-edit="${prefix}title" data-edit-label="${escape(work.title)} — name">${escape(work.title)}</span> ${workArrowHTML}</h2></div></a>`;
}
