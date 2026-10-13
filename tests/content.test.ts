import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanContent, contactHref, validValue } from '../src/cms/content.ts';

test('only our immutable media paths are accepted as replacement images', () => {
  const image = { type: 'image', src: '/media/12345678-1234-4234-9234-123456789abc.webp', alt: 'A ceramic bowl', width: 1600, height: 1200 };
  assert.equal(validValue(image), true);
  for (const src of ['javascript:alert(1)', 'https://example.com/tracker.svg', '/media/../admin', '/media/not-an-id.webp']) {
    assert.equal(validValue({ ...image, src }), false);
  }
  assert.equal(validValue({ ...image, width: 0 }), false);
  assert.equal(validValue({ ...image, thumbnail: '/media/12345678-1234-4234-9234-123456789abc-small.webp' }), false);
});
test('content validation excludes unknown structures and invalid dates', () => {
  assert.equal(validValue({ type: 'date', value: '2026-02-31' }), false);
  assert.equal(validValue({ type: 'date', value: '2026-11-22' }), true);
  const result = cleanContent(JSON.parse('{"__proto__":{"type":"text","value":"bad"},"home.title":{"type":"text","value":"<script>alert(1)</script>"},"home.image":{"type":"html","value":"bad"}}'));
  assert.equal(Object.getPrototypeOf(result), null);
  assert.deepEqual(Object.keys(result), ['home.title']);
  // Text stays plain data; the renderer must escape it, never treat it as HTML.
  assert.equal(result['home.title'].type, 'text');
});
test('contact edits cannot turn an email or phone link into executable markup', () => {
  assert.equal(contactHref('phone', '07702 490932'), 'tel:+447702490932');
  assert.equal(contactHref('email', 'offpat4@gmail.com'), 'mailto:offpat4@gmail.com');
  assert.equal(contactHref('email', 'x@example.com\nBcc: victim@example.com'), undefined);
  assert.equal(contactHref('phone', 'javascript:alert(1)'), undefined);
});
