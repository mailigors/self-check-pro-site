(() => {
  const PAGE_SLUGS = ['horeca', 'uk', 'posutochno', 'klining', 'policy', 'consent'];

  const storedLocale = () => {
    try {
      const raw = String(localStorage.getItem('locale') || '').trim().toLowerCase().replace(/_/g, '-');
      if (raw === 'ru' || raw === 'rus' || raw.startsWith('ru-')) return 'ru';
      if (raw === 'en' || raw === 'eng' || raw.startsWith('en-')) return 'en';
    } catch (error) {
      return null;
    }
    return null;
  };

  const parsePath = (pathname) => {
    let path = pathname || '/';
    let html = false;
    if (path.endsWith('/index.html')) {
      html = true;
      path = path.slice(0, -'/index.html'.length) || '/';
    } else if (path.endsWith('.html')) {
      html = true;
      path = path.slice(0, -'.html'.length);
    }
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

    const english = path.match(/^(.*)\/en(?:\/([a-z0-9-]+))?$/);
    if (english && (!english[2] || PAGE_SLUGS.includes(english[2]))) {
      return { base: english[1], slug: english[2] || '', isEn: true, html };
    }
    const page = path.match(/^(.*)\/([a-z0-9-]+)$/);
    if (page && PAGE_SLUGS.includes(page[2])) {
      return { base: page[1], slug: page[2], isEn: false, html };
    }
    if (path === '/' || path === '') return { base: '', slug: '', isEn: false, html };
    return { base: path, slug: '', isEn: false, html };
  };

  const buildPath = (parts, wantEn) => {
    const prefix = `${parts.base}${wantEn ? '/en' : ''}`;
    if (parts.html) {
      if (!parts.slug) return `${prefix}/index.html`;
      return `${prefix}/${parts.slug}.html`;
    }
    let path = `${prefix}${parts.slug ? `/${parts.slug}` : ''}`;
    if (!path) path = '/';
    if (!path.endsWith('/')) path += '/';
    return path;
  };

  const syncLocale = () => {
    const stored = storedLocale();
    if (!stored) return;
    const parts = parsePath(location.pathname);
    if ((parts.isEn ? 'en' : 'ru') === stored) return;
    const target = buildPath(parts, stored === 'en');
    if (!target || target === location.pathname) return;
    location.replace(target + location.search + location.hash);
  };

  const rememberLocale = (event) => {
    const link = event.target.closest && event.target.closest('.lang-switch a[hreflang]');
    if (!link) return;
    const code = String(link.getAttribute('hreflang') || '').toLowerCase();
    const locale = code.startsWith('en') ? 'en' : code.startsWith('ru') ? 'ru' : null;
    if (!locale) return;
    try { localStorage.setItem('locale', locale); } catch (error) {}
  };

  const jwtExpiry = (token) => {
    if (!token || token.split('.').length !== 3) return null;
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const data = JSON.parse(atob(padded));
      return typeof data.exp === 'number' ? data.exp * 1000 : null;
    } catch (error) {
      return null;
    }
  };

  const tokenIsUsable = (token) => {
    if (!token) return false;
    const expiry = jwtExpiry(token);
    return expiry === null || expiry > Date.now();
  };

  // Кабинет считает сессию живой, пока в localStorage есть access-токен
  // или ещё не истёк refresh-токен. Оба ключа общие для selfcheck.pro и /app/.
  const hasAppSession = () => {
    try {
      const access = localStorage.getItem('token');
      const refresh = localStorage.getItem('refreshToken');
      if (tokenIsUsable(access)) return true;
      return Boolean(access) && tokenIsUsable(refresh);
    } catch (error) {
      return false;
    }
  };

  const applySession = () => {
    const links = document.querySelectorAll('[data-app-entry]');
    if (!links.length) return;
    const signedIn = hasAppSession();
    document.documentElement.classList.toggle('is-app-session', signedIn);
    links.forEach((link) => {
      const guestLabel = link.getAttribute('data-app-guest');
      const sessionLabel = link.getAttribute('data-app-session');
      if (!guestLabel || !sessionLabel) return;
      link.textContent = signedIn ? sessionLabel : guestLabel;
    });
  };

  const start = () => {
    document.addEventListener('click', rememberLocale);
    applySession();
  };

  syncLocale();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('pageshow', () => {
    syncLocale();
    applySession();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'locale') syncLocale();
    if (event.key === 'token' || event.key === 'refreshToken') applySession();
  });
})();
