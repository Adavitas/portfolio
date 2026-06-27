// Apply the preferred theme before the stylesheet renders the page.
(() => {
    const themeStorageKey = 'portfolio-theme';
    const accentStorageKey = 'portfolio-accent';
    const allowedAccents = ['mint', 'amber', 'blue', 'rose'];
    let savedTheme = null;
    let savedAccent = null;

    try {
        savedTheme = localStorage.getItem(themeStorageKey);
        savedAccent = localStorage.getItem(accentStorageKey);
    } catch {
        // Fall back to the operating-system preference when storage is blocked.
    }

    const hasSavedTheme = savedTheme === 'light' || savedTheme === 'dark';
    const systemPrefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
    ).matches;
    let initialTheme = systemPrefersDark ? 'dark' : 'light';

    if (hasSavedTheme) {
        initialTheme = savedTheme;
    }

    document.documentElement.dataset.theme = initialTheme;
    document.documentElement.dataset.accent = allowedAccents.includes(savedAccent)
        ? savedAccent
        : 'mint';
})();
