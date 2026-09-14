// Серверная функция Cloudflare Pages: принимает заявку с формы и шлёт её в Telegram.
// Токен бота живёт в переменных окружения проекта, в код страницы он не попадает.
// Переменные задаются в Cloudflare: Settings → Environment variables
//   TELEGRAM_BOT_TOKEN — токен от @BotFather
//   TELEGRAM_CHAT_ID   — id чата или канала, куда падают заявки

export async function onRequestPost({ request, env }) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  // honeypot: поле скрыто от людей, его заполняют только боты
  if (body.website) return json({ ok: true });

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    return json({ error: "not configured" }, 500);
  }

  const name = String(body.name || "").trim().slice(0, 100);
  const phone = String(body.phone || "").trim().slice(0, 50);
  const company = String(body.company || "").trim().slice(0, 100);
  const page = String(body.page || "").trim().slice(0, 200);
  const source = String(body.source || "").trim().slice(0, 40);

  if (!name || !phone) return json({ error: "name and phone required" }, 400);

  const esc = (t) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // откуда пришла заявка: пригодится, чтобы понять, какая ниша работает
  const NICHE = {
    index: "Главная",
    horeca: "Кафе и рестораны",
    uk: "Управляющие компании",
    posutochno: "Посуточная аренда",
    klining: "Клининг",
  };

  const text =
    `<b>Заявка с сайта</b>\n` +
    `Имя: ${esc(name)}\n` +
    `Телефон: ${esc(phone)}\n` +
    (company ? `Компания: ${esc(company)}\n` : "") +
    (source ? `Раздел: ${esc(NICHE[source] || source)}\n` : "") +
    (page ? `Страница: ${esc(page)}` : "");

  const tg = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    }
  );

  if (!tg.ok) {
    console.error("telegram error", tg.status, await tg.text());
    return json({ error: "telegram failed" }, 502);
  }

  return json({ ok: true });
}
