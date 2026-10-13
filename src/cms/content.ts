export type TextValue = { type: 'text' | 'date'; value: string };
export type ImageValue = { type: 'image'; src: string; thumbnail?: string; thumbnailWidth?: number; alt: string; width: number; height: number };
export type ContentValue = TextValue | ImageValue;
export type Content = Record<string, ContentValue>;

export const mediaPattern = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-small)?\.webp$/;
export function validValue(value: unknown): value is ContentValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as ContentValue;
  if (v.type === 'text') return typeof v.value === 'string' && v.value.length <= 5000;
  if (v.type === 'date') return typeof v.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.value)
    && !Number.isNaN(Date.parse(v.value)) && new Date(v.value).toISOString().slice(0, 10) === v.value;
  return v.type === 'image' && typeof v.src === 'string' && mediaPattern.test(v.src)
    && (!v.thumbnail || (mediaPattern.test(v.thumbnail) && Number.isInteger(v.thumbnailWidth) && v.thumbnailWidth! > 0 && v.thumbnailWidth! <= 2400)) && typeof v.alt === 'string' && v.alt.length <= 500
    && Number.isInteger(v.width) && v.width > 0 && v.width <= 2400
    && Number.isInteger(v.height) && v.height > 0 && v.height <= 2400;
}
export function cleanContent(value: unknown): Content {
  const result: Content = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    if (/^[a-z][a-z0-9.-]{1,119}$/.test(key) && validValue(entry)) result[key] = entry;
  }
  return result;
}
export function dateLabel(day: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
}
export function contactHref(format: string | null, value: string): string | undefined {
  if (format === 'email' && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return 'mailto:' + encodeURIComponent(value).replace(/%40/gi, '@');
  if (format === 'phone' && /^[+\d\s()-]+$/.test(value)) {
    const number = value.replace(/[\s()-]/g, '').replace(/^0/, '+44');
    if (/^\+?\d{7,15}$/.test(number)) return 'tel:' + number;
  }
}
