import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isEditorEmail, loginError } from '../src/cms/login.ts';

test('login hint agrees with the database allowlist and rejects the similar address', async () => {
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  const sql = readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()
    .map(name => readFileSync(new URL(name, migrations), 'utf8')).join('\n');
  const email = [...sql.matchAll(/lower\(u.email\) = '([^']+)'/g)].at(-1)![1];
  assert.equal(email, 'stevendavidlewis80@gmail.com');
  assert.equal(await isEditorEmail(email), true);
  assert.equal(await isEditorEmail(` ${email.toUpperCase()} `), true);
  assert.equal(await isEditorEmail('stevendavidlewis@gmail.com'), false);
  assert.equal(await isEditorEmail('someone@example.com'), false);
});

test('email quotas, verification limits and used codes explain different recovery paths', () => {
  assert.match(loginError({ code: 'over_email_send_rate_limit', status: 429 })!, /unused code/);
  assert.match(loginError({ code: 'over_email_send_rate_limit', status: 429 })!, /hour/);
  assert.match(loginError({ status: 429 })!, /wait/);
  assert.match(loginError({ code: 'otp_expired' })!, /already used/);
  assert.equal(loginError({ message: 'Network error' }), undefined);
});
