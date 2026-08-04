// main.js

document.documentElement.classList.add('js-enabled');

document.addEventListener('DOMContentLoaded', () => {
    // Certificate accordion: retain readable content if enhancement is unavailable.
    const certificateList = document.querySelector('.certificate-list');
    const certificateButtons = Array.from(document.querySelectorAll('.certificate-toggle'));
    const certificateDetails = certificateButtons.map((button) =>
        document.getElementById(button.getAttribute('aria-controls')),
    );
    if (certificateList && certificateButtons.length && certificateDetails.every(Boolean)) {
        function selectCertificate(index) {
            certificateButtons.forEach((button, itemIndex) => {
                const expanded = itemIndex === index;
                button.setAttribute('aria-expanded', String(expanded));
                certificateDetails[itemIndex].hidden = !expanded;
            });
        }
        certificateButtons.forEach((button, index) => {
            button.disabled = false;
            button.addEventListener('click', () => selectCertificate(index));
            button.addEventListener('keydown', (event) => {
                let next = index;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next++;
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next--;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = certificateButtons.length - 1;
                else return;
                event.preventDefault();
                next = (next + certificateButtons.length) % certificateButtons.length;
                selectCertificate(next);
                certificateButtons[next].focus();
            });
        });
        selectCertificate(0);
        certificateList.classList.add('is-ready');
    }

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

    // GitHub Contribution Activity
    const githubActivity = document.querySelector('[data-github-activity]');
    const githubActivityGrid = document.getElementById('github-activity-grid');
    const githubActivityStatus = document.getElementById(
        'github-activity-status',
    );

    if (
        githubActivity &&
        githubActivityGrid &&
        githubActivityStatus &&
        typeof fetch === 'function'
    ) {
        const githubUsername =
            githubActivity.dataset.githubUsername?.trim() || 'Adavitas';
        const activityEndpoint =
            `https://gh-calendar.rschristian.dev/user/` +
            encodeURIComponent(githubUsername);
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        });

        function normalizeActivityDay(day) {
            if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day.date ?? '')) {
                return null;
            }

            const count = Number.parseInt(day.count, 10);
            const intensity = Number.parseInt(day.intensity, 10);

            return {
                date: day.date,
                count: Number.isFinite(count) ? Math.max(0, count) : 0,
                intensity: Number.isFinite(intensity)
                    ? Math.min(4, Math.max(0, intensity))
                    : 0,
            };
        }

        function renderGithubActivity(data) {
            if (!Array.isArray(data?.contributions)) {
                throw new Error('Invalid GitHub activity response');
            }

            const activityDays = data.contributions
                .slice(-53)
                .flatMap((week) => (Array.isArray(week) ? week.slice(0, 7) : []))
                .map(normalizeActivityDay)
                .filter(Boolean);

            if (activityDays.length === 0) {
                throw new Error('GitHub activity response is empty');
            }

            const dayCells = activityDays.map((day) => {
                const dayCell = document.createElement('span');
                const contributionWord =
                    day.count === 1 ? 'contribution' : 'contributions';

                dayCell.className = 'github-activity-day';
                dayCell.dataset.level = String(day.intensity);
                dayCell.setAttribute('aria-hidden', 'true');
                dayCell.title = `${day.count} ${contributionWord} on ${dateFormatter.format(
                    new Date(`${day.date}T12:00:00Z`),
                )}`;

                return dayCell;
            });
            const contributionTotal = activityDays.reduce(
                (total, day) => total + day.count,
                0,
            );
            const formattedTotal = new Intl.NumberFormat('en-US').format(
                contributionTotal,
            );

            githubActivityGrid.textContent = '';
            githubActivityGrid.append(...dayCells);
            githubActivityGrid.classList.remove('is-loading', 'is-unavailable');
            githubActivityGrid.removeAttribute('aria-busy');
            githubActivityGrid.setAttribute(
                'aria-label',
                `${formattedTotal} GitHub contributions in the last year. Each dot represents one day.`,
            );
            githubActivityStatus.textContent =
                `${formattedTotal} contributions in the last year`;
        }

        function showGithubActivityError() {
            githubActivityGrid.classList.remove('is-loading');
            githubActivityGrid.classList.add('is-unavailable');
            githubActivityGrid.removeAttribute('aria-busy');
            githubActivityGrid.setAttribute(
                'aria-label',
                'Live GitHub contribution activity is temporarily unavailable.',
            );
            githubActivityStatus.textContent =
                'Live activity is temporarily unavailable';
        }

        fetch(activityEndpoint)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('GitHub activity request failed');
                }

                return response.json();
            })
            .then(renderGithubActivity)
            .catch(showGithubActivityError);
    }

    // Interactive Section Avatar
    const avatar = document.getElementById('avatar');
    const avatarStateTriggers = document.querySelectorAll(
        '[data-avatar-state]',
    );
    const avatarStateClasses = ['st-works', 'st-hire'];
    const allowedAvatarStates = new Set(['about', 'works', 'hire']);
    let selectedAvatarState = 'about';

    function applyAvatarState(state) {
        if (!avatar) {
            return;
        }

        const nextState = allowedAvatarStates.has(state) ? state : 'about';

        avatarStateClasses.forEach((className) => {
            avatar.classList.toggle(
                className,
                className === `st-${nextState}`,
            );
        });
    }

    function selectAvatarState(state) {
        selectedAvatarState = allowedAvatarStates.has(state) ? state : 'about';
        applyAvatarState(selectedAvatarState);
    }

    function getAvatarStateForSection(section) {
        if (section === 'certificates') {
            return 'hire';
        }

        if (section === 'projects' || section.startsWith('case-')) {
            return 'works';
        }

        return 'about';
    }

    if (avatar) {
        const pupilGroups = avatar.querySelectorAll('.av-pupils');
        const prefersReducedAvatarMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        const scheduleAnimationFrame =
            typeof window.requestAnimationFrame === 'function'
                ? window.requestAnimationFrame.bind(window)
                : null;

        if (
            pupilGroups.length > 0 &&
            !prefersReducedAvatarMotion &&
            scheduleAnimationFrame
        ) {
            let targetX = 0;
            let targetY = 0;
            let eyeX = 0;
            let eyeY = 0;
            const pupilEase = 0.14;

            document.addEventListener('pointermove', (event) => {
                const avatarBounds = avatar.getBoundingClientRect();
                const avatarCenterX =
                    avatarBounds.left + avatarBounds.width / 2;
                const avatarEyeY =
                    avatarBounds.top + avatarBounds.height * 0.47;
                const distanceX = event.clientX - avatarCenterX;
                const distanceY = event.clientY - avatarEyeY;
                const distance =
                    Math.hypot(distanceX, distanceY) || 1;
                const reach = Math.min(distance / 60, 1) * 5;

                targetX = (distanceX / distance) * reach;
                targetY = (distanceY / distance) * reach;
            });

            function animatePupils() {
                eyeX += (targetX - eyeX) * pupilEase;
                eyeY += (targetY - eyeY) * pupilEase;

                const pupilTransform = `translate(${eyeX.toFixed(
                    2,
                )}px, ${eyeY.toFixed(2)}px)`;

                pupilGroups.forEach((pupilGroup) => {
                    pupilGroup.style.transform = pupilTransform;
                });

                scheduleAnimationFrame(animatePupils);
            }

            scheduleAnimationFrame(animatePupils);
        }

        avatarStateTriggers.forEach((trigger) => {
            const previewState = trigger.dataset.avatarState;

            trigger.addEventListener('mouseenter', () => {
                applyAvatarState(previewState);
            });
            trigger.addEventListener('mouseleave', () => {
                applyAvatarState(selectedAvatarState);
            });
            trigger.addEventListener('focus', () => {
                applyAvatarState(previewState);
            });
            trigger.addEventListener('blur', () => {
                applyAvatarState(selectedAvatarState);
            });
        });

        applyAvatarState(selectedAvatarState);
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

                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });

            document.documentElement.dataset.activeSection = activeSection;
            selectAvatarState(getAvatarStateForSection(activeSection));

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
            if (window.location?.hash === targetHash) {
                return;
            }

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

        function getFilterLabel(filterButton, isSingular) {
            const label = filterButton.textContent.trim().toLowerCase();
            return isSingular ? label.replace(/s$/, '') : label;
        }

        function updateProjectFilter(activeButton) {
            const activeFilter = activeButton.dataset.projectFilter ?? 'all';
            let visibleProjects = 0;

            projectFilterButtons.forEach((button) => {
                const isActive = button === activeButton;
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
            const filterLabel = getFilterLabel(
                activeButton,
                visibleProjects === 1,
            );

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
    const timeFormatControl = document.querySelector('.time-format-control');
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

        function scheduleNextTimezoneUpdate() {
            const millisecondsPerMinute = 60000;
            const delay =
                millisecondsPerMinute - (Date.now() % millisecondsPerMinute);

            setTimeout(() => {
                updateTimezones();
                scheduleNextTimezoneUpdate();
            }, delay);
        }

        timeFormatButtons.forEach((button) => {
            button.addEventListener('click', () => {
                setTimeFormat(button.dataset.timeFormat, true);
            });
        });

        setTimeFormat(readSavedTimeFormat() ?? '24');

        if (timeFormatControl && timeFormatButtons.length > 0) {
            timeFormatControl.hidden = false;
        }

        scheduleNextTimezoneUpdate();
    }

});
