(() => {
  const form = document.getElementById('leadForm');
  if (!form) return;
  const field = (name) => form.elements.namedItem(name);
  field('name').maxLength = 100;
  field('phone').maxLength = 50;
  field('company').maxLength = 100;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(status);
  let sending = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    const endpoint = (form.dataset.endpoint || '').trim();
    if (!endpoint) {
      status.textContent = 'Отправка заявок пока не подключена. Напишите на hello@selfcheck.pro.';
      return;
    }
    field('name').setCustomValidity(field('name').value.trim() ? '' : 'Укажите имя.');
    const phone = field('phone').value.trim();
    const digits = phone.replace(/\D/g, '');
    field('phone').setCustomValidity(/^[+\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15 ? '' : 'Проверьте номер телефона.');
    if (!form.reportValidity()) return;
    const button = form.querySelector('button');
    const label = button.textContent;
    sending = true; button.disabled = true; button.textContent = 'Отправляем…';
    status.textContent = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ name: field('name').value.trim(), phone, company: field('company').value.trim(),
          website: field('website').value, page: location.origin + location.pathname, source: form.dataset.source }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok !== true) throw new Error('delivery failed');
      form.replaceChildren(status);
      status.textContent = 'Заявка отправлена. Свяжемся в течение рабочего дня.';
    } catch {
      status.textContent = 'Не удалось подтвердить отправку. Данные сохранены в форме. Попробуйте позже или напишите на hello@selfcheck.pro.';
      button.disabled = false; button.textContent = label;
    } finally { sending = false; clearTimeout(timeout); }
  });
  for (const name of ['name', 'phone']) field(name).addEventListener('input', () => field(name).setCustomValidity(''));
})();
