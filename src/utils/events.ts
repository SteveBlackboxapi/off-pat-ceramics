import type { CollectionEntry } from 'astro:content';

export function londonDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function eventEndDay(event: CollectionEntry<'events'>): string {
  return (event.data.endDate ?? event.data.date).toISOString().slice(0, 10);
}

export function upcomingEvents(events: CollectionEntry<'events'>[], now = new Date()) {
  return events.filter(event => !event.data.draft && eventEndDay(event) >= londonDay(now))
    .sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
}

export function formatEventDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
