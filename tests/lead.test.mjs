import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../functions/api/lead.js', import.meta.url), 'utf8');
const { handleLead } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const env = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '-12345' };
const lead = { name: 'Тест <имя>', phone: '+7 (999) 123-45-67', company: 'A & B', source: 'horeca', page: 'https://selfcheck.pro/horeca?private=1#secret' };
const request = (body, headers = { 'Content-Type': 'application/json' }) => new Request('https://selfcheck.pro/api/lead', { method: 'POST', headers, body: JSON.stringify(body) });
const noCall = () => { throw new Error('Unexpected outgoing request'); };
test('confirmed delivery, escaping, source and URL privacy', async () => {
 let sent;
 const response = await handleLead(request(lead), env, async (url, options) => {
   assert.equal(url, 'https://api.telegram.org/bottest-token/sendMessage');
   sent = JSON.parse(options.body);
   return Response.json({ ok: true });
 });
 assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
 assert.equal(sent.chat_id, '-12345'); assert.match(sent.text, /&lt;имя&gt;/); assert.match(sent.text, /A &amp; B/);
 assert.match(sent.text, /Кафе и рестораны/); assert.ok(!sent.text.includes('private')); assert.ok(!sent.text.includes('secret'));
});
test('reject malformed values and invalid contacts before Telegram', async () => {
 for (const value of [null, [], true, { ...lead, name: {} }, { ...lead, phone: 'abc' }, { ...lead, name: ' ' }, { ...lead, company: 'x'.repeat(101) }, { ...lead, source: '__proto__' }, { ...lead, page: 'javascript:alert(1)' }]) {
  assert.equal((await handleLead(request(value), env, noCall)).status, 400);
 }
});
test('malformed JSON, unsupported media, method, oversized streamed payload', async () => {
 assert.equal((await handleLead(new Request('https://example.com', { method:'POST',headers:{'Content-Type':'application/json'},body:'{' }), env, noCall)).status, 400);
 assert.equal((await handleLead(request(lead, { 'Content-Type': 'text/plain' }), env, noCall)).status, 415);
 assert.equal((await handleLead(new Request('https://example.com'), env, noCall)).status, 405);
 assert.equal((await handleLead(request({ name: 'x'.repeat(9000) }), env, noCall)).status, 413);
});
test('honeypot avoids sending; missing secrets fail clearly', async () => {
 assert.equal((await handleLead(request({ ...lead, website: 'spam' }), env, noCall)).status, 200);
 assert.equal((await handleLead(request(lead), {}, noCall)).status, 503);
});
test('all five page sources are supported', async () => {
 for (const source of ['index','horeca','uk','posutochno','klining']) {
  assert.equal((await handleLead(request({ ...lead, source }), env, async () => Response.json({ ok: true }))).status, 200);
 }
});
test('upstream rejection, malformed response and network failure are not success', async () => {
 for (const fake of [async () => Response.json({ ok:false }), async () => Response.json({ ok:false },{status:429}), async () => new Response('not json'), async () => { throw new Error('network'); }]) {
  const response=await handleLead(request(lead),env,fake);
  assert.equal(response.status,502); assert.equal((await response.json()).error,'telegram unavailable');
 }
});
test('timeout aborts Telegram and returns controlled failure', async () => {
 const original = globalThis.setTimeout;
 globalThis.setTimeout = (fn) => original(fn, 5);
 try {
  const response = await handleLead(request(lead), env, async (_, {signal}) => new Promise((resolve,reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), {once:true})));
  assert.equal(response.status, 502); assert.equal((await response.json()).error,'delivery timeout');
 } finally { globalThis.setTimeout = original; }
});
