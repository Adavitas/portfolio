// main.js

document.documentElement.classList.add('js-enabled');

document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Time Display
    const timeElement = document.getElementById('local-time');

    if (timeElement) {
        function updateTime() {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString();
        }

        // Initial call and set interval
        updateTime();
        setInterval(updateTime, 1000);
    }

    // Responsive Navigation
    const menuButton = document.querySelector('.menu-button');
    const menuButtonLabel = document.querySelector('.menu-button-label');
    const navigation = document.getElementById('nav-links');

    if (menuButton && menuButtonLabel && navigation) {
        function setMenuState(isOpen) {
            navigation.classList.toggle('is-open', isOpen);
            menuButton.setAttribute('aria-expanded', String(isOpen));
            menuButtonLabel.textContent = isOpen ? 'Close' : 'Menu';
        }

        menuButton.addEventListener('click', () => {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
            setMenuState(!isOpen);
        });

        navigation.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                setMenuState(false);
            });
        });

        document.addEventListener('keydown', (event) => {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';

            if (event.key === 'Escape' && isOpen) {
                setMenuState(false);
                menuButton.focus();
            }
        });

        const desktopLayout = window.matchMedia('(min-width: 700px)');

        desktopLayout.addEventListener('change', (event) => {
            if (event.matches) {
                setMenuState(false);
            }
        });
    }
});
