const THEME_STORAGE_KEY = 'zavorth_theme';

export function initThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const iconSun = themeToggle ? themeToggle.querySelector<HTMLElement>('.icon-sun') : null;
  const iconMoon = themeToggle ? themeToggle.querySelector<HTMLElement>('.icon-moon') : null;

  function setTheme(themeName: string) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    if (iconSun && iconMoon) {
      if (themeName === 'light') {
        iconSun.style.display = 'block';
        iconMoon.style.display = 'none';
      } else {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
      }
    }
  }

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  setTheme(savedTheme || 'zavorth');

  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'zavorth' : 'light');
  });
}

