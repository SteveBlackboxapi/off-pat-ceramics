import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, IMAGE_BUCKET } from './config';
import { cleanContent, contactHref, dateLabel, type Content, type ImageValue } from './content';
import { selectedPieces } from '../data/pieces';
import { isEditorEmail, loginError } from './login';
import { addWork, removeWork, customSlugPattern, customWorkSlugs, customWork, customWorks, workCardHTML, workTemplatePath } from './works';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = $<HTMLIFrameElement>('editor-frame');
const page = $<HTMLSelectElement>('editor-page');
const fieldSelect = $<HTMLSelectElement>('editor-field');
let draft: Content = {}, published: Content = {}, version = 0;
let dirty = false, busy = false, previewing = false, ready = false;
let sessionLoad: Promise<void> | undefined;
let userId: string | undefined;
let currentKey = '';
type Field = { key: string; label: string; image: boolean; date: boolean; element: HTMLElement; original: HTMLElement; value: string };
let fields: Field[] = [];
const signed = new Map<string, { url: string; expires: number }>();
const baselineValues = new Map<string, string>();
let renderGeneration = 0;
let focusAfterLoad = '';

function status(message: string, error = false) {
  $('editor-status').textContent = message;
  $('editor-status').dataset.error = String(error);
}
function loginStatus(message: string, error = false) {
  $('login-message').textContent = message;
  $('login-message').dataset.error = String(error);
}
function errorMessage(error: unknown): string {
  const value = error as { message?: string; code?: string };
  if (value?.code === '40001') return 'A newer draft was saved in another tab. Reload this page before saving again.';
  return value?.message || 'Something went wrong. Your changes have not been published. Please try again.';
}
function setBusy(value: boolean) {
  busy = value;
  $('editor-controls').inert = value;
  $<HTMLFieldSetElement>('add-work-fields').disabled = value;
  for (const id of ['save-draft', 'publish', 'sign-out', 'confirm-publish', 'restore-previous']) ($<HTMLButtonElement>(id)).disabled = value;
}
function changed() { dirty = true; status('Unsaved changes — only you can see this draft.'); }
function canonical(content: Content) { return JSON.stringify(Object.fromEntries(Object.entries(content).sort(([a], [b]) => a.localeCompare(b)))); }
function changeCount() {
  return [...new Set([...Object.keys(draft), ...Object.keys(published)])].filter(key => JSON.stringify(draft[key]) !== JSON.stringify(published[key])).length;
}
function fieldValue(field: Field) {
  const value = draft[field.key];
  return value && value.type !== 'image' ? value.value : field.value;
}
async function imageURL(path: string): Promise<string> {
  if (!path.startsWith('/media/')) return path;
  const cached = signed.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await client.storage.from(IMAGE_BUCKET).createSignedUrl('editor/' + path.slice(7), 3600);
  if (error) throw error;
  signed.set(path, { url: data.signedUrl, expires: Date.now() + 3500_000 });
  return data.signedUrl;
}

async function applyPreview() {
  const doc = frame.contentDocument;
  if (!doc) return;
  for (const field of fields) {
    const el = field.element, original = field.original;
    el.style.cssText = original.style.cssText;
    if (field.image) {
      const value = draft[field.key];
      const image = el as HTMLImageElement;
      if (value?.type === 'image') {
        const src = await imageURL(value.src);
        if (draft[field.key] !== value || !image.isConnected) continue;
        image.src = src; image.removeAttribute('srcset');
        image.width = value.width; image.height = value.height; image.alt = value.alt;
      } else {
        for (const name of ['src', 'srcset', 'width', 'height', 'alt']) {
          const value = original.getAttribute(name);
          if (value === null) image.removeAttribute(name); else image.setAttribute(name, value);
        }
      }
      const alt = draft[field.key + '.alt'];
      if (alt?.type === 'text') image.alt = alt.value;
    } else {
      const value = draft[field.key];
      if (value && value.type !== 'image') {
        el.textContent = value.type === 'date' ? dateLabel(value.value) : value.value;
        el.style.whiteSpace = 'pre-line';
        if (value.type === 'date') el.setAttribute('datetime', value.value);
        const href = contactHref(el.dataset.editFormat ?? null, value.value);
        if (href) el.setAttribute('href', href);
      } else {
        el.replaceChildren(...Array.from(original.childNodes).map(node => node.cloneNode(true)));
        for (const name of ['href', 'datetime']) {
          const value = original.getAttribute(name);
          if (value !== null) el.setAttribute(name, value);
        }
      }
    }
  }
  doc.querySelectorAll<HTMLElement>('[data-event-end-key]').forEach(el => {
    const value = draft[el.dataset.eventEndKey!];
    if (value?.type === 'date') el.dataset.eventEnd = value.value;
    // Dates remain available to edit, even when an event has ended.
    el.hidden = false;
  });
}

function selectField(key: string, scroll = false) {
  currentKey = key; fieldSelect.value = key;
  const field = fields.find(f => f.key === key);
  frame.contentDocument?.querySelectorAll('[data-editor-selected]').forEach(el => el.removeAttribute('data-editor-selected'));
  if (field) {
    field.element.setAttribute('data-editor-selected', 'true');
    if (scroll) field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  void renderField();
}
function label(text: string, input: HTMLElement, id: string) {
  const el = document.createElement('label'); el.htmlFor = id; el.textContent = text;
  input.id = id; return [el, input];
}
function button(text: string, handler: () => void) {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'editor-button'; el.textContent = text;
  el.addEventListener('click', handler); return el;
}
async function renderField() {
  const generation = ++renderGeneration;
  const box = $('field-controls'); box.replaceChildren();
  const field = fields.find(f => f.key === currentKey); if (!field) return;
  if (!field.image) {
    const input = field.date ? document.createElement('input') : document.createElement('textarea');
    if (input instanceof HTMLInputElement) input.type = 'date';
    else input.maxLength = 5000;
    input.value = fieldValue(field);
    input.addEventListener('input', () => {
      if (busy || (field.date && !input.value)) return;
      draft[field.key] = { type: field.date ? 'date' : 'text', value: input.value };
      if (field.key.endsWith('.title')) syncWorkOptions();
      changed(); void applyPreview().catch(error => status(errorMessage(error), true));
    });
    box.append(...label(field.label, input, 'field-value'));
  } else {
    const value = draft[field.key];
    const current = value?.type === 'image' ? value : null;
    const photo = document.createElement('img'); photo.className = 'field-image'; photo.alt = 'Current photograph';
    box.append(photo);
    try {
      const src = await imageURL(current?.src ?? field.original.getAttribute('src')!);
      if (generation !== renderGeneration) return; photo.src = src;
    } catch (error) { status(errorMessage(error), true); }
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp';
    file.addEventListener('change', () => { if (file.files?.[0]) void uploadImage(file.files[0], field.key); });
    box.append(...label('Upload a replacement', file, 'image-file'));
    box.append(button('Choose an existing photograph', () => { void showLibrary(blob => uploadImage(blob, field.key)); }));
    const hint = document.createElement('p'); hint.className = 'small-note';
    hint.textContent = 'JPG, PNG or WebP, up to 30 MB. We resize and convert it to WebP for you. Your original stays unchanged.';
    box.append(hint);
    const alt = document.createElement('textarea'); alt.maxLength = 500; alt.rows = 3;
    const altOverride = draft[field.key + '.alt'];
    alt.value = altOverride?.type === 'text' ? altOverride.value : current?.alt ?? field.original.getAttribute('alt') ?? '';
    alt.addEventListener('input', () => {
      if (busy) return;
      draft[field.key + '.alt'] = { type: 'text', value: alt.value };
      changed(); void applyPreview().catch(error => status(errorMessage(error), true));
    });
    box.append(...label('Describe the photograph', alt, 'image-alt'));
  }
  const slug = field.key.split('.')[1];
  if (customSlugPattern.test(slug)) {
    if (page.value === '/gallery') box.append(button('Edit the full artwork details', () => {
      if (busy) return;
      page.value = '/gallery/' + slug; currentKey = `piece.${slug}.description`; loadPage();
    }));
    box.append(button('Remove this piece', () => {
      if (busy || !confirm('Remove this piece from your draft? The website will change only when you publish.')) return;
      draft = removeWork(draft, slug); changed(); syncWorkOptions(); loadPage();
    }));
  } else box.append(button('Reset this item to the original', () => {
    delete draft[field.key]; delete draft[field.key + '.alt']; changed();
    void applyPreview().then(renderField).catch(error => status(errorMessage(error), true));
  }));
}

function collectFields() {
  const doc = frame.contentDocument; if (!doc) return;
  fields = Array.from(doc.querySelectorAll<HTMLElement>('[data-edit],[data-edit-image]')).map(element => ({
    key: element.dataset.edit ?? element.dataset.editImage!,
    label: element.dataset.editLabel ?? element.dataset.edit ?? 'Photograph',
    image: !!element.dataset.editImage, date: element.dataset.editType === 'date', element,
    original: element.cloneNode(true) as HTMLElement,
    value: element.dataset.editType === 'date' ? element.getAttribute('datetime')! : element.innerText.trim(),
  }));
  const unique = fields.filter((f, i) => fields.findIndex(x => x.key === f.key) === i);
  for (const field of unique) baselineValues.set(field.key, field.value);
  fieldSelect.replaceChildren(...unique.map(field => new Option(field.label, field.key)));
  const style = doc.createElement('style');
  style.textContent = 'html:not(.editor-preview-clean) [data-edit],html:not(.editor-preview-clean) [data-edit-image]{cursor:pointer;outline-offset:4px}html:not(.editor-preview-clean) [data-edit]:hover,html:not(.editor-preview-clean) [data-edit-image]:hover{outline:2px dashed #725422}html:not(.editor-preview-clean) [data-editor-selected]{outline:3px solid #725422!important}';
  style.textContent += '.add-work-tile{min-height:260px;border:2px dashed #a79b88;border-radius:4px;background:#f5f0e7;color:#5c4b35;cursor:pointer;font:inherit;text-align:center;padding:2rem}.add-work-tile:hover,.add-work-tile:focus-visible{background:#ebe2d3;border-color:#725422;outline:2px solid #725422;outline-offset:4px}.add-work-tile span{display:block}.add-work-plus{font-size:3rem;line-height:1;margin-bottom:1rem}.add-work-tile small{display:block;font-size:.85rem;margin-top:.5rem}.editor-preview-clean .add-work-tile{display:none!important}';
  doc.head.append(style); doc.documentElement.classList.toggle('editor-preview-clean', previewing);
  doc.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const edit = target.closest<HTMLElement>('[data-edit],[data-edit-image]');
    if (edit && !previewing) { event.preventDefault(); if (!busy) selectField(edit.dataset.edit ?? edit.dataset.editImage!); return; }
    const link = target.closest('a');
    if (link) {
      event.preventDefault();
      const next = new URL(link.href);
      if (next.origin === location.origin && Array.from(page.options).some(option => option.value === next.pathname)) {
        page.value = next.pathname; loadPage();
      } else status('External links and contact buttons stay inactive in the preview.');
    }
  });
  void applyPreview().then(() => {
    selectField(unique.some(f => f.key === currentKey) ? currentKey : unique[0]?.key ?? '', !!focusAfterLoad);
    focusAfterLoad = '';
  }).catch(error => status(errorMessage(error), true));
}
function syncWorkOptions() {
  const selected = page.value;
  page.querySelector('[data-added-works]')?.remove();
  const group = document.createElement('optgroup'); group.label = 'Added artwork'; group.dataset.addedWorks = '';
  for (const slug of customWorkSlugs(draft)) {
    const title = draft[`piece.${slug}.title`];
    group.append(new Option(title?.type === 'text' && title.value.trim() ? title.value : 'Untitled piece', '/gallery/' + slug));
  }
  if (group.children.length) page.append(group);
  page.value = Array.from(page.options).some(option => option.value === selected) ? selected : '/gallery';
}
async function preparePreview() {
  const doc = frame.contentDocument;
  if (!doc || !ready || !doc.querySelector('[data-edit]')) return;
  const selected = page.value;
  const slug = selected.split('/')[2];
  if (slug && customSlugPattern.test(slug)) {
    doc.querySelectorAll<HTMLElement>('[data-edit],[data-edit-image]').forEach(el => {
      for (const attr of ['data-edit', 'data-edit-image']) {
        const key = el.getAttribute(attr);
        if (key) el.setAttribute(attr, key.replace(/^piece\.template\./, `piece.${slug}.`));
      }
    });
  }
  const grid = doc.querySelector('[data-works-grid]');
  if (grid) {
    const markup = await Promise.all(customWorks(draft).map(async work => workCardHTML(work, await imageURL(work.image.src))));
    if (doc !== frame.contentDocument || selected !== page.value) return;
    grid.insertAdjacentHTML('beforeend', markup.join(''));
    const add = doc.createElement('button'); add.type = 'button'; add.className = 'work-card add-work-tile';
    add.innerHTML = '<span class="add-work-plus" aria-hidden="true">+</span><span>Add work</span><small>A photograph and a few words</small>';
    add.addEventListener('click', () => { if (!busy && !previewing) openAddWork(); });
    grid.append(add);
  }
  collectFields();
}
function loadPage() {
  const slug = page.value.split('/')[2];
  frame.src = (slug && customSlugPattern.test(slug) ? workTemplatePath : page.value) + '?editor-preview=1';
}
frame.addEventListener('load', () => { void preparePreview().catch(error => status(errorMessage(error), true)); });
page.addEventListener('change', loadPage);
fieldSelect.addEventListener('change', () => selectField(fieldSelect.value, true));

async function webp(bitmap: ImageBitmap, edge: number) {
  const ratio = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext('2d'); if (!context) throw new Error('This browser cannot prepare images. Please try Chrome or Safari.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image conversion failed.')), 'image/webp', 0.84));
  if (blob.type !== 'image/webp' || blob.size > 6 * 1024 * 1024) throw new Error('Please try a smaller photograph.');
  return { blob, width: canvas.width, height: canvas.height };
}
async function prepareImage(blob: Blob, alt: string, progress = status): Promise<ImageValue> {
  progress('Preparing a smaller WebP image…');
  let bitmap: ImageBitmap | undefined;
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 30 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP photograph under 30 MB.');
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const full = await webp(bitmap, 1600);
    const small = Math.max(full.width, full.height) > 800 ? await webp(bitmap, 800) : undefined;
    const id = crypto.randomUUID();
    progress('Saving the photograph to your private image library…');
    const { error } = await client.storage.from(IMAGE_BUCKET).upload(`editor/${id}.webp`, full.blob, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    if (small) {
      const { error } = await client.storage.from(IMAGE_BUCKET).upload(`editor/${id}-small.webp`, small.blob, { contentType: 'image/webp', upsert: false });
      if (error) throw error;
    }
    return {
      type: 'image', src: `/media/${id}.webp`, width: full.width, height: full.height,
      ...(small ? { thumbnail: `/media/${id}-small.webp`, thumbnailWidth: small.width } : {}),
      alt,
    };
  } finally { bitmap?.close(); }
}
async function uploadImage(blob: Blob, key: string) {
  if (busy) return;
  setBusy(true);
  try {
    const original = fields.find(f => f.key === key)?.original as HTMLImageElement | undefined;
    const previous = draft[key], altOverride = draft[key + '.alt'];
    const alt = altOverride?.type === 'text' ? altOverride.value : previous?.type === 'image' ? previous.alt : original?.alt ?? '';
    draft[key] = await prepareImage(blob, alt);
    changed(); await applyPreview(); await renderField();
    status('Photograph ready. Save your draft or publish when ready.');
  } catch (error) { status(errorMessage(error), true); }
  finally { setBusy(false); }
}

async function showLibrary(choose: (blob: Blob) => void | Promise<void>, reportError = status) {
  const dialog = $<HTMLDialogElement>('image-library'); dialog.showModal();
  const box = $('library-items'); box.textContent = 'Loading your photographs…';
  try {
    const [root, uploads] = await Promise.all([
      client.storage.from(IMAGE_BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } }),
      client.storage.from(IMAGE_BUCKET).list('editor', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
    ]);
    if (root.error) throw root.error; if (uploads.error) throw uploads.error;
    const paths = [
      ...(root.data ?? []).filter(x => x.id && /\.(jpe?g|png|webp)$/i.test(x.name)).map(x => x.name),
      ...(uploads.data ?? []).filter(x => x.id && x.name.endsWith('.webp') && !x.name.endsWith('-small.webp')).map(x => 'editor/' + x.name),
    ];
    const signedResults = paths.length ? await client.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 600) : { data: [], error: null };
    if (signedResults.error) throw signedResults.error;
    const choices = [
      ...selectedPieces.map(piece => ({ label: piece.title, url: piece.image, path: null as string | null })),
      ...(signedResults.data ?? []).filter(item => item.signedUrl).map(item => ({ label: item.path?.startsWith('editor/') ? 'Uploaded photograph' : item.path!, url: item.signedUrl, path: item.path! })),
    ];
    box.replaceChildren();
    for (const choice of choices) {
      const pick = document.createElement('button'); pick.type = 'button';
      const image = document.createElement('img'); image.src = choice.url; image.alt = choice.label; image.loading = 'lazy';
      const name = document.createElement('span'); name.textContent = choice.label;
      pick.append(image, name);
      pick.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true); dialog.close();
        try {
          let blob: Blob;
          if (choice.path) {
            const { data, error } = await client.storage.from(IMAGE_BUCKET).download(choice.path); if (error) throw error; blob = data;
          } else {
            const response = await fetch(choice.url); if (!response.ok) throw new Error('Could not load this image.'); blob = await response.blob();
          }
          setBusy(false);
          await choose(blob);
        } catch (error) { reportError(errorMessage(error), true); }
        finally { setBusy(false); }
      });
      box.append(pick);
    }
  } catch (error) { box.textContent = errorMessage(error); }
}
$('close-library').addEventListener('click', () => $<HTMLDialogElement>('image-library').close());

let newWorkPhoto: Blob | undefined;
let newWorkPhotoURL = '';
const addDialog = $<HTMLDialogElement>('add-work-dialog');
function workMessage(message: string, error = false) {
  $('new-work-message').textContent = message;
  $('new-work-message').dataset.error = String(error);
}
function openAddWork() {
  $<HTMLFormElement>('add-work-form').reset();
  newWorkPhoto = undefined;
  if (newWorkPhotoURL) URL.revokeObjectURL(newWorkPhotoURL);
  newWorkPhotoURL = ''; $('new-work-preview').hidden = true;
  workMessage('This piece will be added to your private draft.');
  addDialog.showModal(); $<HTMLInputElement>('new-work-title').focus();
}
function chooseWorkPhoto(blob: Blob) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 30 * 1024 * 1024) {
    newWorkPhoto = undefined; $('new-work-preview').hidden = true;
    workMessage('Choose a JPG, PNG or WebP photograph under 30 MB.', true); return;
  }
  if (newWorkPhotoURL) URL.revokeObjectURL(newWorkPhotoURL);
  newWorkPhoto = blob; newWorkPhotoURL = URL.createObjectURL(blob);
  const preview = $<HTMLImageElement>('new-work-preview'); preview.src = newWorkPhotoURL; preview.hidden = false;
  workMessage('Photograph selected. Add the piece when you are ready.');
}
$('new-work-image').addEventListener('change', () => {
  const file = $<HTMLInputElement>('new-work-image').files?.[0];
  if (file) chooseWorkPhoto(file);
});
$('new-work-library').addEventListener('click', () => {
  if (!busy) void showLibrary(chooseWorkPhoto, workMessage);
});
$('cancel-add-work').addEventListener('click', () => { if (!busy) addDialog.close(); });
addDialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
addDialog.addEventListener('close', () => {
  if (newWorkPhotoURL) URL.revokeObjectURL(newWorkPhotoURL);
  newWorkPhotoURL = ''; newWorkPhoto = undefined;
});
$('add-work-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const title = $<HTMLInputElement>('new-work-title').value.trim();
  if (!title) { workMessage('Give this piece a name.', true); return; }
  if (!newWorkPhoto) { workMessage('Choose a photograph for this piece.', true); return; }
  setBusy(true);
  try {
    const image = await prepareImage(newWorkPhoto, title, workMessage);
    const slug = 'work-' + crypto.randomUUID();
    draft = addWork(draft, { slug, title, image,
      kind: $<HTMLInputElement>('new-work-kind').value,
      description: $<HTMLTextAreaElement>('new-work-description').value,
    });
    changed(); syncWorkOptions(); page.value = '/gallery';
    currentKey = `piece.${slug}.title`; focusAfterLoad = currentKey;
    addDialog.close(); loadPage();
    status('New piece added to your draft. Save it for later, or preview and publish when ready.');
  } catch (error) { workMessage(errorMessage(error), true); }
  finally { setBusy(false); }
});

function validate() {
  for (const slug of customWorkSlugs(draft)) {
    if (!customWork(draft, slug)) throw new Error('Every added piece needs an artwork name and photograph.');
  }
  for (const key of ['shared.email', 'shared.phone']) {
    const value = draft[key];
    if (value?.type === 'text' && !contactHref(key.split('.')[1], value.value)) throw new Error(`Please enter a valid ${key === 'shared.email' ? 'email address' : 'phone number'}.`);
  }
  for (const [key, value] of Object.entries(draft)) {
    if (value.type !== 'date') continue;
    const prefix = key.replace(/\.(start|end)$/, '');
    const start = draft[prefix + '.start'], end = draft[prefix + '.end'];
    const first = start?.type === 'date' ? start.value : baselineValues.get(prefix + '.start');
    const last = end?.type === 'date' ? end.value : baselineValues.get(prefix + '.end');
    if (first && last && first > last) throw new Error('The event end date must be on or after its start date.');
  }
}
async function save(publish: boolean) {
  if (busy) return;
  try {
    validate(); setBusy(true); status(publish ? 'Publishing your changes…' : 'Saving your private draft…');
    const snapshot = structuredClone(draft);
    const { data, error } = await client.rpc('offpat_save_content', { new_content: snapshot, expected_version: version, publish });
    if (error) throw error;
    version = data.version; dirty = false;
    if (publish) published = structuredClone(snapshot);
    status(publish ? 'Published. Your changes are now on the website.' : 'Draft saved. The public website has not changed.');
  } catch (error) { status(errorMessage(error), true); }
  finally { setBusy(false); }
}
$('save-draft').addEventListener('click', () => void save(false));
$('publish').addEventListener('click', () => {
  if (busy) return;
  if (!changeCount()) { status('There are no changes to publish.'); return; }
  $('publish-summary').textContent = `${changeCount()} changed item${changeCount() === 1 ? '' : 's'} across your website.`;
  $<HTMLDialogElement>('publish-dialog').showModal();
});
$('cancel-publish').addEventListener('click', () => $<HTMLDialogElement>('publish-dialog').close());
$('confirm-publish').addEventListener('click', () => { $<HTMLDialogElement>('publish-dialog').close(); void save(true); });
$('toggle-preview').addEventListener('click', () => {
  previewing = !previewing;
  $('editor-controls').hidden = previewing;
  $('editor-workspace').classList.toggle('preview-only', previewing);
  frame.contentDocument?.documentElement.classList.toggle('editor-preview-clean', previewing);
  $('toggle-preview').textContent = previewing ? 'Back to editing' : 'Preview';
});
$('restore-previous').addEventListener('click', async () => {
  if (busy || (dirty && !confirm('Replace your unsaved edits with the previous published version?'))) return;
  setBusy(true);
  try {
    const { data, error } = await client.from('offpat_content_history').select('content').order('id', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) { status('There is no earlier published version yet.'); return; }
    draft = cleanContent(data.content); dirty = true; syncWorkOptions(); loadPage();
    status('Previous version restored to your draft. Review it, then publish if you want to use it.');
  } catch (error) { status(errorMessage(error), true); }
  finally { setBusy(false); }
});

let pendingEmail = '', loginBusy = false, resendAt = 0;
let resendTimer: number | undefined;
function updateLoginControls() {
  for (const id of ['send-code', 'have-code', 'verify-code', 'change-email', 'login-email', 'login-code']) {
    $<HTMLButtonElement | HTMLInputElement>(id).disabled = loginBusy;
  }
  const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  const send = $<HTMLButtonElement>('send-code');
  send.disabled = loginBusy || seconds > 0;
  send.textContent = seconds ? `Request another code in ${seconds}s` : 'Email me a code';
  const resend = $<HTMLButtonElement>('resend-code');
  resend.disabled = loginBusy || seconds > 0;
  resend.textContent = seconds ? `Send another code in ${seconds}s` : 'Send another code';
  if (!seconds && resendTimer !== undefined) { window.clearInterval(resendTimer); resendTimer = undefined; }
}
function resetLogin() {
  pendingEmail = '';
  $<HTMLInputElement>('login-code').value = '';
  $('code-email').textContent = '';
  $('code-form').hidden = true; $('login-form').hidden = false;
  updateLoginControls();
}
function showCodeEntry(email: string) {
  pendingEmail = email;
  $('code-email').textContent = email;
  $<HTMLInputElement>('login-code').value = '';
  $('login-form').hidden = true; $('code-form').hidden = false;
}
function startResendWait() {
  resendAt = Date.now() + 60_000;
  if (resendTimer !== undefined) window.clearInterval(resendTimer);
  resendTimer = window.setInterval(updateLoginControls, 1000);
}
async function checkEmail(email: string) {
  if (await isEditorEmail(email)) return true;
  loginStatus('This email address is not approved for editing. Check it exactly matches the address you asked us to enable. No code has been sent.', true);
  return false;
}
async function requestCode(email: string) {
  if (loginBusy || Date.now() < resendAt) return;
  email = email.trim().toLowerCase();
  loginBusy = true; updateLoginControls();
  loginStatus('Sending your sign-in code…');
  try {
    if (!await checkEmail(email)) return;
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
    showCodeEntry(email);
    startResendWait();
    loginStatus('Check your inbox and spam folder, then enter the latest code here.');
  } catch (error) {
    if ((error as { status?: number }).status === 429) startResendWait();
    loginStatus(loginError(error) ?? errorMessage(error), true);
  }
  finally {
    loginBusy = false; updateLoginControls();
    if (pendingEmail) $<HTMLInputElement>('login-code').focus();
  }
}
$('login-form').addEventListener('submit', event => {
  event.preventDefault();
  void requestCode($<HTMLInputElement>('login-email').value.trim());
});
$('have-code').addEventListener('click', async () => {
  if (loginBusy || !$<HTMLFormElement>('login-form').reportValidity()) return;
  const email = $<HTMLInputElement>('login-email').value.trim().toLowerCase();
  if (!await checkEmail(email)) return;
  showCodeEntry(email);
  loginStatus('Enter your latest unused code. No new email has been sent.');
  $<HTMLInputElement>('login-code').focus();
});
$('resend-code').addEventListener('click', () => {
  if (pendingEmail && Date.now() >= resendAt) void requestCode(pendingEmail);
});
$('change-email').addEventListener('click', () => {
  if (loginBusy) return;
  resetLogin(); loginStatus('Enter the email address you want to sign in with.');
  $<HTMLInputElement>('login-email').focus();
});
$('login-code').addEventListener('input', () => {
  const input = $<HTMLInputElement>('login-code');
  input.value = input.value.replace(/[^0-9]/g, '');
});
$('code-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (loginBusy || !pendingEmail) return;
  const input = $<HTMLInputElement>('login-code');
  const token = input.value.trim();
  if (!/^[0-9]{6,10}$/.test(token)) { loginStatus('Enter the full code from your email.', true); input.focus(); return; }
  loginBusy = true; updateLoginControls(); loginStatus('Checking your code…');
  try {
    const { error } = await client.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });
    if (error) throw error;
    input.value = '';
    await refreshSession();
  } catch (error) {
    loginStatus(loginError(error) ?? errorMessage(error), true);
  } finally {
    loginBusy = false; updateLoginControls();
    if (!$('code-form').hidden) { input.focus(); input.select(); }
  }
});
$('sign-out').addEventListener('click', async () => {
  if (dirty && !confirm('Sign out without saving these changes?')) return;
  const { error } = await client.auth.signOut();
  if (error) { status(errorMessage(error), true); return; }
  dirty = false; ready = false; signed.clear(); draft = {}; published = {}; fields = [];
  frame.src = 'about:blank'; userId = undefined;
  resetLogin();
  $('editor-app').hidden = true; $('editor-login').hidden = false; loginStatus('You are signed out.');
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

function refreshSession(): Promise<void> {
  return sessionLoad ??= loadEditorSession().finally(() => { sessionLoad = undefined; });
}
async function loadEditorSession() {
  try {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError && userError.name !== 'AuthSessionMissingError') throw userError;
    if (!user) {
      if (ready) {
        ready = false; resetLogin(); $('editor-app').hidden = true; $('editor-login').hidden = false; frame.src = 'about:blank';
        loginStatus('Your session has ended. Sign in again to continue.', true);
      }
      return;
    }
    if (ready && user.id === userId) return;
    const { data, error } = await client.from('offpat_content').select('id,content,version');
    if (error) throw error;
    const saved = data?.find(row => row.id === 'draft');
    if (!saved) {
      resetLogin();
      loginStatus(`Your code was accepted, but ${user.email ?? 'this email address'} is not approved for editing. Check the approved email address before requesting another code.`, true);
      await client.auth.signOut({ scope: 'local' });
      return;
    }
    const keepUnsaved = dirty && user.id === userId;
    userId = user.id;
    if (!keepUnsaved) { draft = cleanContent(saved.content); version = saved.version; }
    published = cleanContent(data?.find(row => row.id === 'published')?.content);
    dirty = keepUnsaved; ready = true;
    resetLogin();
    $('editor-login').hidden = true; $('editor-app').hidden = false;
    status(keepUnsaved ? 'Your unsaved changes are still here. Save your draft when ready.' : canonical(draft) === canonical(published) ? 'You are editing the published version. Changes stay private until you publish.' : 'Your saved draft has unpublished changes.');
    syncWorkOptions(); loadPage();
  } catch (error) {
    const message = loginError(error) ?? errorMessage(error);
    if (ready) status(message, true); else loginStatus(message, true);
  }
}
client.auth.onAuthStateChange(() => { window.setTimeout(() => { void refreshSession(); }, 0); });
void refreshSession();
