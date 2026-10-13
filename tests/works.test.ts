import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanContent, type Content } from '../src/cms/content.ts';
import { addWork, customWorks, removeWork, type AddedWork } from '../src/cms/works.ts';

export const work: AddedWork = {
  slug: 'work-12345678-1234-4234-9234-123456789abc', title: 'Tide & clay', kind: 'Bowl', description: 'A new piece.',
  image: { type: 'image', src: '/media/12345678-1234-4234-9234-123456789abc.webp',
    thumbnail: '/media/12345678-1234-4234-9234-123456789abc-small.webp', thumbnailWidth: 800,
    alt: 'A handmade bowl', width: 1600, height: 1200 },
};

test('adding, saving, restoring and removing a piece preserves existing edits and image references', () => {
  const existing: Content = { 'piece.crackle-bowl.title': { type: 'text', value: 'Tidal Bowl' } };
  const draft = addWork(existing, work);
  const reloaded = cleanContent(JSON.parse(JSON.stringify(draft)));
  assert.equal(customWorks(reloaded)[0].title, work.title);
  assert.deepEqual(existing, { 'piece.crackle-bowl.title': { type: 'text', value: 'Tidal Bowl' } });
  // Image remains a top-level value, as required by the existing Storage RLS policy.
  assert.equal(reloaded[`piece.${work.slug}.image`].type, 'image');
  assert.deepEqual(removeWork(reloaded, work.slug), existing);
  assert.deepEqual(removeWork(reloaded, 'crackle-bowl'), reloaded);
  assert.equal(customWorks(cleanContent(draft)).length, 1);
});

test('incomplete or untrusted artwork is not rendered publicly', () => {
  const draft = addWork({}, work);
  draft[`piece.${work.slug}.title`] = { type: 'text', value: '  ' };
  assert.equal(customWorks(draft).length, 0);
  assert.throws(() => addWork({}, { ...work, image: { ...work.image, src: 'https://example.com/tracker' } }));
  assert.throws(() => addWork({}, { ...work, slug: 'blue-coast' }));
});
