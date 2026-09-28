const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/send') return json({ error: 'not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const authorization = request.headers.get('Authorization');
    if (!env.RELAY_SECRET || authorization !== `Bearer ${env.RELAY_SECRET}`) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
      return json({ error: 'json required' }, 415);
    }

    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 8192) {
        return json({ error: 'payload too large' }, 413);
      }
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'bad json' }, 400);
    }

    if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 3500) {
      return json({ error: 'invalid message' }, 400);
    }
    if (!env.TELEGRAM_BOT_TOKEN || !/^-\d+$/.test(String(env.TELEGRAM_CHAT_ID || ''))) {
      return json({ error: 'not configured' }, 503);
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(env.TELEGRAM_CHAT_ID),
          text: body.text,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        }),
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) return json({ error: 'telegram unavailable' }, 502);
      return json({ ok: true });
    } catch {
      return json({ error: 'telegram unavailable' }, 502);
    }
  },
};
