// main.js

document.documentElement.classList.add('js-enabled');

document.addEventListener('DOMContentLoaded', () => {
    const accentStorageKey = 'portfolio-accent';
    const allowedAccents = ['mint', 'amber', 'blue', 'rose'];

    // Theme Switcher
    const themeButton = document.querySelector('.theme-button');
    const themeButtonLabel = document.querySelector('.theme-button-label');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const themeStorageKey = 'portfolio-theme';

    if (themeButton && themeButtonLabel) {
        function readSavedTheme() {
            try {
                const savedTheme = localStorage.getItem(themeStorageKey);
                return savedTheme === 'light' || savedTheme === 'dark'
                    ? savedTheme
                    : null;
            } catch {
                return null;
            }
        }

        function saveTheme(theme) {
            try {
                localStorage.setItem(themeStorageKey, theme);
            } catch {
                // The selected theme still works for this page load.
            }
        }

        function updateThemeButton(theme) {
            const nextTheme = theme === 'dark' ? 'light' : 'dark';
            const nextThemeName = nextTheme === 'light' ? 'Light' : 'Dark';

            themeButtonLabel.textContent = nextThemeName;
            themeButton.setAttribute(
                'aria-label',
                `Switch to ${nextTheme} theme`,
            );
        }

        function setTheme(theme, shouldSave = false) {
            document.documentElement.dataset.theme = theme;
            updateThemeButton(theme);

            if (shouldSave) {
                saveTheme(theme);
            }
        }

        let hasExplicitTheme = Boolean(readSavedTheme());
        const initialTheme =
            document.documentElement.dataset.theme === 'light'
                ? 'light'
                : 'dark';
        updateThemeButton(initialTheme);
        themeButton.classList.add('is-ready');

        themeButton.addEventListener('click', () => {
            const currentTheme =
                document.documentElement.dataset.theme === 'light'
                    ? 'light'
                    : 'dark';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            hasExplicitTheme = true;
            setTheme(nextTheme, true);
        });

        systemTheme.addEventListener('change', (event) => {
            if (!hasExplicitTheme) {
                setTheme(event.matches ? 'dark' : 'light');
            }
        });
    }

    // Accent Palette
    const accentButtons = document.querySelectorAll('.accent-swatch');

    if (accentButtons.length > 0) {
        function readSavedAccent() {
            try {
                const savedAccent = localStorage.getItem(accentStorageKey);
                return allowedAccents.includes(savedAccent) ? savedAccent : null;
            } catch {
                return null;
            }
        }

        function saveAccent(accent) {
            try {
                localStorage.setItem(accentStorageKey, accent);
            } catch {
                // The selected accent still works for this page load.
            }
        }

        function setAccent(accent, shouldSave = false) {
            const nextAccent = allowedAccents.includes(accent) ? accent : 'mint';

            document.documentElement.dataset.accent = nextAccent;

            accentButtons.forEach((button) => {
                const isActive = button.dataset.accent === nextAccent;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });

            if (shouldSave) {
                saveAccent(nextAccent);
            }
        }

        const initialAccent = allowedAccents.includes(
            document.documentElement.dataset.accent,
        )
            ? document.documentElement.dataset.accent
            : readSavedAccent() ?? 'mint';

        setAccent(initialAccent);

        accentButtons.forEach((button) => {
            button.addEventListener('click', () => {
                setAccent(button.dataset.accent, true);
            });
        });
    }

    // Home Section Switcher
    const sectionLinks = document.querySelectorAll('[data-section-link]');
    const panelLinks = document.querySelectorAll('[data-panel-link]');
    const sectionPanels = document.querySelectorAll('[data-section-panel]');

    if (sectionLinks.length > 0 && sectionPanels.length > 0) {
        const defaultSection = 'about';
        const sections = new Set(
            [...sectionPanels]
                .map((panel) => panel.dataset.sectionPanel)
                .filter(Boolean),
        );

        function getSectionFromHash() {
            const hash = window.location?.hash?.replace('#', '') ?? '';

            if (hash === 'hero' || hash === 'about') {
                return 'about';
            }

            return sections.has(hash) ? hash : defaultSection;
        }

        function setActiveSection(section) {
            const activeSection = sections.has(section) ? section : defaultSection;

            sectionPanels.forEach((panel) => {
                panel.hidden = panel.dataset.sectionPanel !== activeSection;
            });

            sectionLinks.forEach((link) => {
                const isActive = link.dataset.sectionLink === activeSection;

                link.classList.toggle('is-active', isActive);

                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });

            document.documentElement.dataset.activeSection = activeSection;

            return (
                [...sectionPanels].find(
                    (panel) => panel.dataset.sectionPanel === activeSection,
                ) ?? null
            );
        }

        function scrollSectionIntoView(sectionPanel) {
            if (!sectionPanel?.scrollIntoView) {
                return;
            }

            const prefersReducedMotion =
                window.matchMedia?.('(prefers-reduced-motion: reduce)')
                    .matches ?? false;

            sectionPanel.scrollIntoView({
                block: 'start',
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
            });
        }

        function focusSectionPanel(sectionPanel) {
            if (!sectionPanel?.focus) {
                return;
            }

            sectionPanel.focus({ preventScroll: true });
        }

        function showSection(section, options = {}) {
            const activePanel = setActiveSection(section);

            if (!activePanel) {
                return null;
            }

            if (options.resetPanelScroll) {
                activePanel.scrollTop = 0;
            }

            if (options.scroll) {
                scrollSectionIntoView(activePanel);
            }

            if (options.focus) {
                focusSectionPanel(activePanel);
            }

            return activePanel;
        }

        function pushHash(targetHash) {
            if (window.history?.pushState) {
                window.history.pushState(null, '', targetHash);
            } else if (window.location) {
                window.location.hash = targetHash;
            }
        }

        function bindPanelLink(link) {
            link.addEventListener('click', (event) => {
                const section = link.dataset.sectionLink ?? link.dataset.panelLink;

                if (!sections.has(section)) {
                    return;
                }

                event.preventDefault();

                const targetHash = link.getAttribute('href') || `#${section}`;

                pushHash(targetHash);
                showSection(section, {
                    focus: true,
                    resetPanelScroll: true,
                    scroll: true,
                });
            });
        }

        sectionLinks.forEach((link) => {
            bindPanelLink(link);
        });

        panelLinks.forEach((link) => {
            bindPanelLink(link);
        });

        if (window.addEventListener) {
            window.addEventListener('hashchange', () => {
                showSection(getSectionFromHash(), {
                    focus: true,
                    scroll: true,
                });
            });

            window.addEventListener('popstate', () => {
                showSection(getSectionFromHash(), {
                    focus: true,
                    scroll: true,
                });
            });
        }

        showSection(getSectionFromHash());
    }

    // One-time Card Reveals
    const revealElements = document.querySelectorAll('[data-reveal]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (
        revealElements.length > 0 &&
        !reducedMotion.matches &&
        'IntersectionObserver' in window
    ) {
        document.documentElement.classList.add('reveal-enabled');
        let remainingElements = revealElements.length;

        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                    remainingElements -= 1;
                });

                if (remainingElements === 0) {
                    revealObserver.disconnect();
                }
            },
            {
                rootMargin: '0px 0px -8% 0px',
                threshold: 0.12,
            },
        );

        revealElements.forEach((element) => {
            revealObserver.observe(element);
        });

        reducedMotion.addEventListener('change', (event) => {
            if (event.matches) {
                revealObserver.disconnect();
                document.documentElement.classList.remove('reveal-enabled');
            }
        });
    }

    // Pointer Spotlight Cards
    const spotlightCards = document.querySelectorAll('.card-spotlight');
    const finePointer = window.matchMedia('(pointer: fine)');

    if (spotlightCards.length > 0 && finePointer.matches) {
        spotlightCards.forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 100;
                const y = ((event.clientY - rect.top) / rect.height) * 100;

                card.style.setProperty('--spotlight-x', `${x}%`);
                card.style.setProperty('--spotlight-y', `${y}%`);
            });

            card.addEventListener('pointerleave', () => {
                card.style.removeProperty('--spotlight-x');
                card.style.removeProperty('--spotlight-y');
            });
        });
    }

    // Project Filter
    const projectFilterButtons = document.querySelectorAll(
        '.project-filter-button',
    );
    const projectCards = document.querySelectorAll('.project-card');
    const projectFilterStatus = document.getElementById(
        'project-filter-status',
    );

    if (
        projectFilterButtons.length > 0 &&
        projectCards.length > 0 &&
        projectFilterStatus
    ) {
        function projectMatchesFilter(projectCard, filter) {
            if (filter === 'all') {
                return true;
            }

            const categories = (
                projectCard.dataset.projectCategories ?? ''
            ).split(/\s+/);

            return categories.includes(filter);
        }

        function getFilterLabel(filterButton) {
            return filterButton.textContent.trim().toLowerCase();
        }

        function updateProjectFilter(activeButton) {
            const activeFilter = activeButton.dataset.projectFilter ?? 'all';
            let visibleProjects = 0;

            projectFilterButtons.forEach((button) => {
                const isActive = button === activeButton;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });

            projectCards.forEach((projectCard) => {
                const shouldShow = projectMatchesFilter(
                    projectCard,
                    activeFilter,
                );

                projectCard.hidden = !shouldShow;

                if (shouldShow) {
                    visibleProjects += 1;
                }
            });

            const projectWord = visibleProjects === 1 ? 'project' : 'projects';
            const filterLabel = getFilterLabel(activeButton);

            projectFilterStatus.textContent =
                activeFilter === 'all'
                    ? `Showing all ${visibleProjects} ${projectWord}.`
                    : `Showing ${visibleProjects} ${filterLabel} ${projectWord}.`;
        }

        projectFilterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                updateProjectFilter(button);
            });
        });

        const initialActiveButton =
            [...projectFilterButtons].find(
                (button) => button.getAttribute('aria-pressed') === 'true',
            ) ?? projectFilterButtons[0];

        updateProjectFilter(initialActiveButton);
    }

    // Dynamic Timezone Display
    const timeFormatStorageKey = 'portfolio-time-format';
    const homeTimeElement = document.getElementById('home-time');
    const visitorTimeElement = document.getElementById('visitor-time');
    const homeTimezoneLabel = document.getElementById('home-timezone-label');
    const visitorTimezoneLabel = document.getElementById(
        'visitor-timezone-label',
    );
    const timeFormatButtons = document.querySelectorAll('.time-format-button');

    if (homeTimeElement && visitorTimeElement) {
        const homeTimezone =
            homeTimeElement.dataset.timezone || 'Europe/Berlin';
        let activeTimeFormat = '24';

        function readSavedTimeFormat() {
            try {
                const savedTimeFormat = localStorage.getItem(timeFormatStorageKey);
                return savedTimeFormat === '12' || savedTimeFormat === '24'
                    ? savedTimeFormat
                    : null;
            } catch {
                return null;
            }
        }

        function saveTimeFormat(timeFormat) {
            try {
                localStorage.setItem(timeFormatStorageKey, timeFormat);
            } catch {
                // The selected time format still works for this page load.
            }
        }

        function updateTimeFormatButtons(timeFormat) {
            timeFormatButtons.forEach((button) => {
                const isActive = button.dataset.timeFormat === timeFormat;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        function getVisitorTimezone() {
            try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            } catch {
                return 'UTC';
            }
        }

        function formatTime(date, timezone, timeFormat) {
            return new Intl.DateTimeFormat(undefined, {
                hour: 'numeric',
                hour12: timeFormat === '12',
                minute: '2-digit',
                timeZone: timezone,
            }).format(date);
        }

        function formatTimezoneLabel(timezone) {
            try {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    timeZoneName: 'short',
                }).formatToParts(new Date());
                const timezonePart = parts.find(
                    (part) => part.type === 'timeZoneName',
                );

                return timezonePart?.value ?? timezone;
            } catch {
                return timezone;
            }
        }

        function updateTimezones() {
            const now = new Date();
            const visitorTimezone = getVisitorTimezone();

            homeTimeElement.textContent = formatTime(
                now,
                homeTimezone,
                activeTimeFormat,
            );
            homeTimeElement.dateTime = now.toISOString();
            visitorTimeElement.textContent = formatTime(
                now,
                visitorTimezone,
                activeTimeFormat,
            );
            visitorTimeElement.dateTime = now.toISOString();

            if (homeTimezoneLabel) {
                homeTimezoneLabel.textContent = formatTimezoneLabel(homeTimezone);
            }

            if (visitorTimezoneLabel) {
                visitorTimezoneLabel.textContent =
                    formatTimezoneLabel(visitorTimezone);
            }
        }

        function setTimeFormat(timeFormat, shouldSave = false) {
            activeTimeFormat = timeFormat === '12' ? '12' : '24';
            document.documentElement.dataset.timeFormat = activeTimeFormat;
            updateTimeFormatButtons(activeTimeFormat);
            updateTimezones();

            if (shouldSave) {
                saveTimeFormat(activeTimeFormat);
            }
        }

        timeFormatButtons.forEach((button) => {
            button.addEventListener('click', () => {
                setTimeFormat(button.dataset.timeFormat, true);
            });
        });

        setTimeFormat(readSavedTimeFormat() ?? '24');
        setInterval(updateTimezones, 60000);
    }

    // Contact Form Validation and Email Draft
    const contactForm = document.getElementById('contact-form');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const messageError = document.getElementById('message-error');
    const formStatus = document.getElementById('form-status');
    const emailDraftLink = document.getElementById('email-draft-link');

    if (
        contactForm &&
        nameInput &&
        emailInput &&
        messageInput &&
        nameError &&
        emailError &&
        messageError &&
        formStatus &&
        emailDraftLink
    ) {
        const fields = [
            { input: nameInput, error: nameError },
            { input: emailInput, error: emailError },
            { input: messageInput, error: messageError },
        ];

        contactForm.noValidate = true;

        function clearFieldError(input, errorElement) {
            input.removeAttribute('aria-invalid');
            errorElement.textContent = '';
        }

        function showFieldError(input, errorElement, message) {
            input.setAttribute('aria-invalid', 'true');
            errorElement.textContent = message;
        }

        function resetPreparedEmail() {
            formStatus.textContent = '';
            formStatus.className = 'form-status';
            emailDraftLink.hidden = true;
            emailDraftLink.removeAttribute('href');
        }

        fields.forEach(({ input, error }) => {
            input.addEventListener('input', () => {
                clearFieldError(input, error);
                resetPreparedEmail();
            });
        });

        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();

            fields.forEach(({ input, error }) => {
                clearFieldError(input, error);
            });
            resetPreparedEmail();

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const message = messageInput.value.trim();
            let firstInvalidField = null;

            if (name.length < 2) {
                showFieldError(
                    nameInput,
                    nameError,
                    'Enter a name with at least two characters.',
                );
                firstInvalidField = nameInput;
            }

            if (!email) {
                showFieldError(
                    emailInput,
                    emailError,
                    'Enter your email address.',
                );
                firstInvalidField = firstInvalidField || emailInput;
            } else if (!emailInput.validity.valid) {
                showFieldError(
                    emailInput,
                    emailError,
                    'Enter an email address in the format name@example.com.',
                );
                firstInvalidField = firstInvalidField || emailInput;
            }

            if (message.length < 20) {
                showFieldError(
                    messageInput,
                    messageError,
                    'Write a message with at least 20 characters.',
                );
                firstInvalidField = firstInvalidField || messageInput;
            }

            if (firstInvalidField) {
                formStatus.textContent = 'Please correct the highlighted fields.';
                formStatus.classList.add('is-error');
                firstInvalidField.focus();
                return;
            }

            const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
            const body = encodeURIComponent(
                [`Name: ${name}`, `Email: ${email}`, '', 'Message:', message].join(
                    '\n',
                ),
            );

            emailDraftLink.href =
                `mailto:leqso.davitashvili.st@gmail.com?subject=${subject}` +
                `&body=${body}`;
            emailDraftLink.hidden = false;
            formStatus.textContent =
                'Your message is ready. Open the draft, review it, and send it from your email application.';
            formStatus.classList.add('is-success');
            emailDraftLink.focus();
        });
    }
});
