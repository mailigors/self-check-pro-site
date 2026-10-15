(() => {
  const links = document.querySelectorAll('[data-app-entry]');
  if (!links.length) return;

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

    const apply = () => {
    const signedIn = hasAppSession();
    document.documentElement.classList.toggle('is-app-session', signedIn);
    links.forEach((link) => {
      const guestLabel = link.getAttribute('data-app-guest');
      const sessionLabel = link.getAttribute('data-app-session');
      if (!guestLabel || !sessionLabel) return;
      link.textContent = signedIn ? sessionLabel : guestLabel;
    });
  };

  apply();
  window.addEventListener('pageshow', apply);
  window.addEventListener('storage', (event) => {
    if (event.key === 'token' || event.key === 'refreshToken') apply();
  });
})();
