// Apply the preferred theme before the stylesheet renders the page.
(() => {
    const themeStorageKey = 'portfolio-theme';
    let savedTheme = null;

    try {
        savedTheme = localStorage.getItem(themeStorageKey);
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
})();
