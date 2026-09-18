// Cloudflare Pages adapter. Other hosts can call handleLead(request, env).
const SOURCES = Object.freeze({
  index: 'Главная', horeca: 'Кафе и рестораны', uk: 'Управляющие компании',
  posutochno: 'Посуточная аренда', klining: 'Клининг',
});
const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function handleLead(request, env = {}, fetchTelegram = fetch) {
  if (request.method !== 'POST') return reply({ error: 'method not allowed' }, 405);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return reply({ error: 'json required' }, 415);
  }
  // Limit actual streamed bytes, not only the untrusted Content-Length header.
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: 'bad json' }, 400);
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return reply({ error: 'payload too large' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return reply({ error: 'bad json' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'invalid fields' }, 400);
  if (typeof body.website === 'string' && body.website.trim()) return reply({ ok: true });
  const limits = { name: 100, phone: 50, company: 100, page: 500, source: 40, website: 200 };
  for (const [field, max] of Object.entries(limits)) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > max)) {
      return reply({ error: 'invalid fields' }, 400);
    }
  }
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  if (!name || !/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) {
    return reply({ error: 'invalid contact' }, 400);
  }
  const company = (body.company || '').trim();
  const source = body.source || 'index';
  if (!Object.hasOwn(SOURCES, source)) return reply({ error: 'invalid source' }, 400);
  let page = '';
  if (body.page) {
    try {
      const url = new URL(body.page);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      // Do not forward query parameters, fragments or URL credentials.
      page = url.origin + url.pathname;
    } catch { return reply({ error: 'invalid page' }, 400); }
  }
  if (!env.TELEGRAM_BOT_TOKEN || !/^-\d+$/.test(String(env.TELEGRAM_CHAT_ID || ''))) {
    return reply({ error: 'not configured' }, 503);
  }
  const text = '<b>Новая заявка — SelfCheck Pro</b>\n' +
    `Имя: ${escapeHtml(name)}\nТелефон: ${escapeHtml(phone)}\n` +
    (company ? `Компания: ${escapeHtml(company)}\n` : '') +
    `Раздел: ${SOURCES[source]}` + (page ? `\nСтраница: ${escapeHtml(page)}` : '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchTelegram(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(env.TELEGRAM_CHAT_ID), text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) return reply({ error: 'telegram unavailable' }, 502);
    return reply({ ok: true });
  } catch {
    // Never log tokens, request contents or upstream responses containing contacts.
    return reply({ error: controller.signal.aborted ? 'delivery timeout' : 'telegram unavailable' }, 502);
  } finally { clearTimeout(timeout); }
}

export function onRequest({ request, env }) { return handleLead(request, env); }
