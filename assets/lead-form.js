(() => {
  const form = document.getElementById('leadForm');
  if (!form) return;
  const isEnglish = document.documentElement.lang === 'en';
  const copy = isEnglish ? {
    unavailable: 'Requests are not connected yet. Email hello@selfcheck.pro.',
    name: 'Enter your name.',
    phone: 'Enter the full number: +7 (XXX) XXX-XX-XX.',
    email: 'Enter an email in the format name@example.com.',
    sending: 'Sending…',
    success: 'Request sent. We will contact you within one business day.',
    error: 'We could not confirm delivery. Your data remains in the form. Try again later or email hello@selfcheck.pro.',
  } : {
    unavailable: 'Отправка заявок пока не подключена. Напишите на hello@selfcheck.pro.',
    name: 'Укажите имя.',
    phone: 'Введите номер полностью: +7 (XXX) XXX-XX-XX.',
    email: 'Введите email в формате name@example.com.',
    sending: 'Отправляем…',
    success: 'Заявка отправлена. Свяжемся в течение рабочего дня.',
    error: 'Не удалось подтвердить отправку. Данные сохранены в форме. Попробуйте позже или напишите на hello@selfcheck.pro.',
  };
  const field = (name) => form.elements.namedItem(name);
  field('name').maxLength = 100;
  const phoneField = field('phone');
  phoneField.maxLength = 18;
  phoneField.inputMode = 'tel';
  phoneField.placeholder = '+7 (XXX) XXX-XX-XX';
  const emailField = field('email');
  emailField.maxLength = 30;
  field('company').maxLength = 100;
  field('comment').maxLength = 140;
  const formatRussianPhone = (value) => {
    let digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits[0] === '8') digits = `7${digits.slice(1)}`;
    else if (digits[0] !== '7') digits = `7${digits}`;
    const local = digits.slice(1, 11);
    let formatted = '+7';
    if (local.length) formatted += ` (${local.slice(0, 3)}`;
    if (local.length >= 3) formatted += ')';
    if (local.length > 3) formatted += ` ${local.slice(3, 6)}`;
    if (local.length > 6) formatted += `-${local.slice(6, 8)}`;
    if (local.length > 8) formatted += `-${local.slice(8, 10)}`;
    return formatted;
  };
  phoneField.addEventListener('input', () => {
    phoneField.value = formatRussianPhone(phoneField.value);
    phoneField.setCustomValidity('');
  });
  phoneField.addEventListener('keydown', (event) => {
    if (event.key !== 'Backspace' || phoneField.selectionStart !== phoneField.selectionEnd ||
        phoneField.selectionStart !== phoneField.value.length || /\d$/.test(phoneField.value)) return;
    event.preventDefault();
    const digits = phoneField.value.replace(/\D/g, '').slice(0, -1);
    phoneField.value = formatRussianPhone(digits);
  });
  phoneField.addEventListener('blur', () => {
    if (phoneField.value.replace(/\D/g, '').length <= 1) phoneField.value = '';
  });
  emailField.addEventListener('input', () => {
    emailField.value = emailField.value.replace(/\s/g, '').slice(0, 30);
    emailField.setCustomValidity('');
  });
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
      status.textContent = copy.unavailable;
      return;
    }
    field('name').setCustomValidity(field('name').value.trim() ? '' : copy.name);
    const phone = phoneField.value.trim();
    const digits = phone.replace(/\D/g, '');
    phoneField.setCustomValidity(digits.length === 11 && digits.startsWith('7') ? '' : copy.phone);
    const email = emailField.value.trim();
    emailField.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : copy.email);
    if (!form.reportValidity()) return;
    const button = form.querySelector('button');
    const label = button.textContent;
    sending = true; button.disabled = true; button.textContent = copy.sending;
    status.textContent = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ name: field('name').value.trim(), phone, email, company: field('company').value.trim(),
          comment: field('comment').value.trim(),
          website: field('website').value, page: location.origin + location.pathname, source: form.dataset.source }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok !== true) throw new Error('delivery failed');
      form.replaceChildren(status);
      status.textContent = copy.success;
    } catch {
      status.textContent = copy.error;
      button.disabled = false; button.textContent = label;
    } finally { sending = false; clearTimeout(timeout); }
  });
  field('name').addEventListener('input', () => field('name').setCustomValidity(''));
})();
