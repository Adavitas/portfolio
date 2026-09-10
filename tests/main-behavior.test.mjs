import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
const mainSource = await readFile(path.join(rootDirectory, 'js/main.js'), 'utf8');
const themeInitSource = await readFile(
    path.join(rootDirectory, 'js/theme-init.js'),
    'utf8',
);

function createEvent(type, properties = {}) {
    return {
        type,
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        ...properties,
    };
}

class MockClassList {
    constructor(owner) {
        this.owner = owner;
        this.tokens = new Set();
    }

    setFromString(value) {
        this.tokens = new Set(String(value).trim().split(/\s+/).filter(Boolean));
    }

    sync() {
        this.owner._className = [...this.tokens].join(' ');
    }

    add(...tokens) {
        tokens.forEach((token) => this.tokens.add(token));
        this.sync();
    }

    remove(...tokens) {
        tokens.forEach((token) => this.tokens.delete(token));
        this.sync();
    }

    toggle(token, force) {
        const shouldAdd = force === undefined ? !this.tokens.has(token) : Boolean(force);

        if (shouldAdd) {
            this.tokens.add(token);
        } else {
            this.tokens.delete(token);
        }

        this.sync();
        return shouldAdd;
    }

    contains(token) {
        return this.tokens.has(token);
    }

    toString() {
        return [...this.tokens].join(' ');
    }
}

class MockStyle {
    constructor() {
        this.properties = new Map();
    }

    setProperty(name, value) {
        this.properties.set(name, String(value));
    }

    getPropertyValue(name) {
        return this.properties.get(name) ?? '';
    }

    removeProperty(name) {
        const previousValue = this.getPropertyValue(name);
        this.properties.delete(name);
        return previousValue;
    }
}

class MockElement {
    constructor(tagName = 'div', options = {}) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.ownerDocument = null;
        this.attributes = new Map();
        this.dataset = {};
        this.eventListeners = new Map();
        this.textContent = '';
        this.value = '';
        this.hidden = false;
        this.noValidate = false;
        this.dateTime = '';
        this.validity = { valid: true };
        this.focusCount = 0;
        this.scrollIntoViewCalls = [];
        this.boundingClientRect = {
            left: 0,
            top: 0,
            width: 1,
            height: 1,
        };
        this._className = '';
        this.classList = new MockClassList(this);
        this.style = new MockStyle();

        if (options.id) {
            this.setAttribute('id', options.id);
        }

        if (options.className) {
            this.className = options.className;
        }

        for (const [name, value] of Object.entries(options.attributes ?? {})) {
            this.setAttribute(name, value);
        }
    }

    set className(value) {
        this._className = String(value);
        this.classList.setFromString(this._className);
    }

    get className() {
        return this.classList.toString();
    }

    setAttribute(name, value) {
        const stringValue = String(value);
        this.attributes.set(name, stringValue);

        if (name === 'id') {
            this.id = stringValue;
        }

        if (name === 'class') {
            this.className = stringValue;
        }

        if (name === 'href') {
            this.href = stringValue;
        }

        if (name.startsWith('data-')) {
            const datasetKey = name
                .slice(5)
                .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

            this.dataset[datasetKey] = stringValue;
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);

        if (name === 'href') {
            delete this.href;
        }
    }

    append(...children) {
        for (const child of children) {
            child.parentElement = this;
            child.ownerDocument = this.ownerDocument;
            this.children.push(child);
        }
    }

    addEventListener(type, callback) {
        const listeners = this.eventListeners.get(type) ?? [];
        listeners.push(callback);
        this.eventListeners.set(type, listeners);
    }

    dispatchEvent(event) {
        if (!event.target) {
            event.target = this;
        }

        event.currentTarget = this;

        for (const callback of this.eventListeners.get(event.type) ?? []) {
            callback(event);
        }

        return !event.defaultPrevented;
    }

    focus() {
        this.focusCount += 1;

        if (this.ownerDocument) {
            this.ownerDocument.activeElement = this;
        }
    }

    scrollIntoView(options) {
        this.scrollIntoViewCalls.push(options);
    }

    getBoundingClientRect() {
        return this.boundingClientRect;
    }

    matches(selector) {
        if (selector === 'a') {
            return this.tagName === 'A';
        }

        if (selector.startsWith('.')) {
            return this.classList.contains(selector.slice(1));
        }

        if (selector.startsWith('#')) {
            return this.id === selector.slice(1);
        }

        if (selector === '[data-reveal]') {
            return this.attributes.has('data-reveal');
        }

        const attributeSelector = selector.match(/^\[([a-z0-9-]+)\]$/i);

        if (attributeSelector) {
            return this.attributes.has(attributeSelector[1]);
        }

        return false;
    }

    querySelectorAll(selector) {
        const matches = [];

        function visit(element) {
            for (const child of element.children) {
                if (child.matches(selector)) {
                    matches.push(child);
                }

                visit(child);
            }
        }

        visit(this);
        return matches;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
    }
}

class MockDocument {
    constructor() {
        this.eventListeners = new Map();
        this.activeElement = null;
        this.documentElement = new MockElement('html');
        this.documentElement.ownerDocument = this;
    }

    createElement(tagName, options = {}) {
        const element = new MockElement(tagName, options);
        element.ownerDocument = this;
        return element;
    }

    append(element, parent = this.documentElement) {
        element.ownerDocument = this;
        parent.append(element);
        return element;
    }

    addEventListener(type, callback) {
        const listeners = this.eventListeners.get(type) ?? [];
        listeners.push(callback);
        this.eventListeners.set(type, listeners);
    }

    dispatchEvent(event) {
        if (!event.target) {
            event.target = this;
        }

        event.currentTarget = this;

        for (const callback of this.eventListeners.get(event.type) ?? []) {
            callback(event);
        }
    }

    querySelectorAll(selector) {
        const matches = this.documentElement.matches(selector)
            ? [this.documentElement]
            : [];

        return matches.concat(this.documentElement.querySelectorAll(selector));
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
    }

    getElementById(id) {
        return this.querySelector(`#${id}`);
    }
}

function createStorage(options = {}) {
    const values = new Map(Object.entries(options.initial ?? {}));

    return {
        getItem(key) {
            if (options.failGet) {
                throw new Error('storage get blocked');
            }

            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            if (options.failSet) {
                throw new Error('storage set blocked');
            }

            values.set(key, String(value));
        },
        valueFor(key) {
            return values.get(key);
        },
    };
}

function createMatchMediaController(initialMatches = {}) {
    const queries = new Map();

    function getQuery(query) {
        if (!queries.has(query)) {
            const listeners = new Set();
            const state = {
                matches: Boolean(initialMatches[query]),
            };

            queries.set(query, {
                media: query,
                get matches() {
                    return state.matches;
                },
                addEventListener(type, callback) {
                    if (type === 'change') {
                        listeners.add(callback);
                    }
                },
                removeEventListener(type, callback) {
                    if (type === 'change') {
                        listeners.delete(callback);
                    }
                },
                trigger(matches) {
                    state.matches = Boolean(matches);
                    const event = { matches: state.matches, media: query };

                    for (const callback of listeners) {
                        callback(event);
                    }
                },
            });
        }

        return queries.get(query);
    }

    return {
        matchMedia(query) {
            return getQuery(query);
        },
        set(query, matches) {
            getQuery(query).trigger(matches);
        },
    };
}

function createIntersectionObserverMock() {
    const observers = [];

    class MockIntersectionObserver {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            this.observed = [];
            this.unobserved = [];
            this.disconnected = false;
            observers.push(this);
        }

        observe(element) {
            this.observed.push(element);
        }

        unobserve(element) {
            this.unobserved.push(element);
            this.observed = this.observed.filter((item) => item !== element);
        }

        disconnect() {
            this.disconnected = true;
            this.observed = [];
        }

        trigger(entries) {
            this.callback(entries, this);
        }
    }

    return {
        observers,
        IntersectionObserver: MockIntersectionObserver,
    };
}

function runMain(options = {}) {
    const document = options.document ?? new MockDocument();
    const media = options.media ?? createMatchMediaController();
    const storage = options.storage ?? createStorage();
    const timeouts = [];
    const historyPushes = [];
    const windowListeners = new Map();
    const window = {
        matchMedia: media.matchMedia,
        location: {
            hash: options.locationHash ?? '',
        },
        history: {
            pushState(_state, _title, url) {
                historyPushes.push(String(url));
                const hashIndex = String(url).indexOf('#');

                window.location.hash =
                    hashIndex >= 0 ? String(url).slice(hashIndex) : '';
            },
        },
        addEventListener(type, callback) {
            const listeners = windowListeners.get(type) ?? [];
            listeners.push(callback);
            windowListeners.set(type, listeners);
        },
        dispatchEvent(event) {
            for (const callback of windowListeners.get(event.type) ?? []) {
                callback(event);
            }
        },
    };

    const context = {
        console,
        document,
        window,
        localStorage: storage,
        setTimeout(callback, delay) {
            timeouts.push({ callback, delay });
            return timeouts.length;
        },
        Date: options.DateConstructor ?? Date,
        Intl,
        encodeURIComponent,
    };

    if (options.fetch) {
        context.fetch = options.fetch;
    }

    if (options.intersectionObserver) {
        window.IntersectionObserver =
            options.intersectionObserver.IntersectionObserver;
        context.IntersectionObserver =
            options.intersectionObserver.IntersectionObserver;
    }

    vm.runInNewContext(mainSource, context, { filename: 'js/main.js' });
    document.dispatchEvent(createEvent('DOMContentLoaded'));

    return {
        document,
        historyPushes,
        timeouts,
        window,
    };
}

function runThemeInit(options = {}) {
    const document = new MockDocument();
    const media = options.media ?? createMatchMediaController();

    vm.runInNewContext(
        themeInitSource,
        {
            document,
            window: {
                matchMedia: media.matchMedia,
            },
            localStorage: options.storage ?? createStorage(),
        },
        { filename: 'js/theme-init.js' },
    );

    return document;
}

function appendElement(document, tagName, options = {}, parent) {
    const element = document.createElement(tagName, options);
    document.append(element, parent);
    return element;
}

function createThemeDom(initialTheme = 'dark') {
    const document = new MockDocument();
    document.documentElement.dataset.theme = initialTheme;
    const button = appendElement(document, 'button', {
        className: 'theme-button',
        attributes: { 'aria-label': 'Switch theme' },
    });
    const label = appendElement(
        document,
        'span',
        { className: 'theme-button-label' },
        button,
    );

    return {
        document,
        button,
        label,
    };
}

function createAccentDom(initialAccent = 'mint') {
    const document = new MockDocument();
    document.documentElement.dataset.accent = initialAccent;

    const mintButton = appendElement(document, 'button', {
        className: 'accent-swatch',
        attributes: {
            'aria-pressed': 'true',
            'data-accent': 'mint',
        },
    });
    mintButton.textContent = 'Mint';

    const amberButton = appendElement(document, 'button', {
        className: 'accent-swatch',
        attributes: {
            'aria-pressed': 'false',
            'data-accent': 'amber',
        },
    });
    amberButton.textContent = 'Amber';

    const blueButton = appendElement(document, 'button', {
        className: 'accent-swatch',
        attributes: {
            'aria-pressed': 'false',
            'data-accent': 'blue',
        },
    });
    blueButton.textContent = 'Blue';

    const roseButton = appendElement(document, 'button', {
        className: 'accent-swatch',
        attributes: {
            'aria-pressed': 'false',
            'data-accent': 'rose',
        },
    });
    roseButton.textContent = 'Rose';

    return {
        document,
        mintButton,
        amberButton,
        blueButton,
        roseButton,
    };
}

function createGithubActivityDom() {
    const document = new MockDocument();
    const activity = appendElement(document, 'section', {
        attributes: {
            'data-github-activity': '',
            'data-github-username': 'Adavitas',
        },
    });
    const status = appendElement(
        document,
        'p',
        { id: 'github-activity-status' },
        activity,
    );
    const grid = appendElement(
        document,
        'div',
        {
            id: 'github-activity-grid',
            className: 'github-activity-grid is-loading',
            attributes: {
                'aria-busy': 'true',
            },
        },
        activity,
    );

    return {
        activity,
        document,
        grid,
        status,
    };
}

function createRevealDom(count) {
    const document = new MockDocument();
    const revealElements = Array.from({ length: count }, () =>
        appendElement(document, 'section', {
            attributes: { 'data-reveal': '' },
        }),
    );

    return {
        document,
        revealElements,
    };
}

function createSectionSwitcherDom() {
    const document = new MockDocument();
    const aboutLink = appendElement(document, 'a', {
        attributes: {
            href: '#hero',
            'aria-current': 'page',
            'data-section-link': 'about',
        },
    });
    aboutLink.textContent = 'About';

    const projectsLink = appendElement(document, 'a', {
        attributes: {
            href: '#projects',
            'data-section-link': 'projects',
        },
    });
    projectsLink.textContent = 'Projects';

    const certificatesLink = appendElement(document, 'a', {
        attributes: {
            href: '#certificates',
            'data-section-link': 'certificates',
        },
    });
    certificatesLink.textContent = 'Certificates';

    const casePortfolioLink = appendElement(document, 'a', {
        attributes: {
            href: '#case-portfolio',
            'data-project-link': 'case-portfolio',
        },
    });
    casePortfolioLink.textContent = 'Read portfolio case study';

    const aboutPanel = appendElement(document, 'section', {
        id: 'hero',
        attributes: {
            'data-section-panel': 'about',
        },
    });

    const projectsPanel = appendElement(document, 'section', {
        id: 'projects',
        attributes: {
            'data-section-panel': 'projects',
        },
    });

    const certificatesPanel = appendElement(document, 'section', {
        id: 'certificates',
        attributes: {
            'data-section-panel': 'certificates',
        },
    });

    const casePortfolioPanel = appendElement(document, 'section', {
        id: 'case-portfolio',
        attributes: {
            'data-project-panel': 'case-portfolio',
        },
    }, projectsPanel);

    const caseMinishellLink = appendElement(document, 'a', {
        attributes: { href: '#case-minishell', 'data-project-link': 'case-minishell' },
    });
    const caseMinishellPanel = appendElement(document, 'section', {
        id: 'case-minishell', attributes: { 'data-project-panel': 'case-minishell' },
    }, projectsPanel);

    return {
        document,
        aboutLink,
        projectsLink,
        certificatesLink,
        casePortfolioLink,
        caseMinishellLink,
        caseMinishellPanel,
        aboutPanel,
        projectsPanel,
        certificatesPanel,
        casePortfolioPanel,
    };
}

function createTimezoneDom(options = {}) {
    const document = new MockDocument();
    const timeFormatControl = appendElement(document, 'div', {
        className: 'time-format-control',
    });
    timeFormatControl.hidden = true;
    const homeTime = appendElement(document, 'time', {
        id: 'home-time',
        attributes: { 'data-timezone': 'Europe/Berlin' },
    });
    const visitorTime = appendElement(document, 'time', { id: 'visitor-time' });
    const homeTimezoneLabel = appendElement(document, 'span', {
        id: 'home-timezone-label',
    });
    const visitorTimezoneLabel = appendElement(document, 'span', {
        id: 'visitor-timezone-label',
    });
    const twentyFourHourButton = options.withoutFormatButtons
        ? null
        : appendElement(
              document,
              'button',
              {
                  className: 'time-format-button',
                  attributes: {
                      'aria-pressed': 'true',
                      'data-time-format': '24',
                  },
              },
              timeFormatControl,
          );
    const twelveHourButton = options.withoutFormatButtons
        ? null
        : appendElement(
              document,
              'button',
              {
                  className: 'time-format-button',
                  attributes: {
                      'aria-pressed': 'false',
                      'data-time-format': '12',
                  },
              },
              timeFormatControl,
          );

    return {
        document,
        homeTime,
        visitorTime,
        homeTimezoneLabel,
        timeFormatControl,
        visitorTimezoneLabel,
        twelveHourButton,
        twentyFourHourButton,
    };
}

test('theme-init accepts saved light and dark themes', () => {
    for (const theme of ['light', 'dark']) {
        const media = createMatchMediaController({
            '(prefers-color-scheme: dark)': theme !== 'dark',
        });
        const document = runThemeInit({
            media,
            storage: createStorage({ initial: { 'portfolio-theme': theme } }),
        });

        assert.equal(document.documentElement.dataset.theme, theme);
    }
});

test('theme-init applies saved accent before styles render', () => {
    for (const accent of ['mint', 'amber', 'blue', 'rose']) {
        const document = runThemeInit({
            media: createMatchMediaController({
                '(prefers-color-scheme: dark)': true,
            }),
            storage: createStorage({
                initial: {
                    'portfolio-accent': accent,
                },
            }),
        });

        assert.equal(document.documentElement.dataset.accent, accent);
    }
});

test('theme-init falls back safely for invalid saved values and storage failure', () => {
    const invalidThemeDocument = runThemeInit({
        media: createMatchMediaController({
            '(prefers-color-scheme: dark)': true,
        }),
        storage: createStorage({
            initial: {
                'portfolio-theme': 'blue',
                'portfolio-accent': 'purple',
            },
        }),
    });

    assert.equal(invalidThemeDocument.documentElement.dataset.theme, 'dark');
    assert.equal(invalidThemeDocument.documentElement.dataset.accent, 'mint');

    const blockedStorageDocument = runThemeInit({
        media: createMatchMediaController({
            '(prefers-color-scheme: dark)': false,
        }),
        storage: createStorage({ failGet: true }),
    });

    assert.equal(blockedStorageDocument.documentElement.dataset.theme, 'light');
    assert.equal(blockedStorageDocument.documentElement.dataset.accent, 'mint');
});

test('theme button updates data-theme and describes the next action', () => {
    const { document, button, label } = createThemeDom('dark');
    const storage = createStorage();

    runMain({ document, storage });

    assert.equal(label.textContent, 'Light');
    assert.equal(button.getAttribute('aria-label'), 'Switch to light theme');

    button.dispatchEvent(createEvent('click'));

    assert.equal(document.documentElement.dataset.theme, 'light');
    assert.equal(label.textContent, 'Dark');
    assert.equal(button.getAttribute('aria-label'), 'Switch to dark theme');
    assert.equal(storage.valueFor('portfolio-theme'), 'light');
});

test('theme selection still works when saving to localStorage fails', () => {
    const { document, button } = createThemeDom('dark');

    runMain({
        document,
        storage: createStorage({ failSet: true }),
    });

    assert.doesNotThrow(() => button.dispatchEvent(createEvent('click')));
    assert.equal(document.documentElement.dataset.theme, 'light');
});

test('system theme changes apply only before an explicit user choice', () => {
    const { document, button } = createThemeDom('dark');
    const media = createMatchMediaController({
        '(prefers-color-scheme: dark)': true,
    });

    runMain({
        document,
        media,
        storage: createStorage(),
    });

    media.set('(prefers-color-scheme: dark)', false);
    assert.equal(document.documentElement.dataset.theme, 'light');

    button.dispatchEvent(createEvent('click'));
    assert.equal(document.documentElement.dataset.theme, 'dark');

    media.set('(prefers-color-scheme: dark)', false);
    assert.equal(document.documentElement.dataset.theme, 'dark');
});

test('accent swatches update data-accent, pressed state, and storage', () => {
    const { document, mintButton, blueButton, roseButton } = createAccentDom();
    const storage = createStorage();

    runMain({ document, storage });

    assert.equal(document.documentElement.dataset.accent, 'mint');
    assert.equal(mintButton.getAttribute('aria-pressed'), 'true');

    blueButton.dispatchEvent(createEvent('click'));

    assert.equal(document.documentElement.dataset.accent, 'blue');
    assert.equal(storage.valueFor('portfolio-accent'), 'blue');
    assert.equal(mintButton.getAttribute('aria-pressed'), 'false');
    assert.equal(blueButton.getAttribute('aria-pressed'), 'true');

    roseButton.dispatchEvent(createEvent('click'));

    assert.equal(document.documentElement.dataset.accent, 'rose');
    assert.equal(storage.valueFor('portfolio-accent'), 'rose');
    assert.equal(blueButton.getAttribute('aria-pressed'), 'false');
    assert.equal(roseButton.getAttribute('aria-pressed'), 'true');
});

test('GitHub activity renders contribution levels and an accessible summary', async () => {
    const { document, grid, status } = createGithubActivityDom();
    let requestedUrl = '';

    runMain({
        document,
        fetch: async (url) => {
            requestedUrl = url;

            return {
                ok: true,
                async json() {
                    return {
                        contributions: [
                            [
                                { date: '2026-07-19', count: 0, intensity: '0' },
                                { date: '2026-07-20', count: 1, intensity: '1' },
                                { date: '2026-07-21', count: 5, intensity: '4' },
                            ],
                        ],
                    };
                },
            };
        },
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(
        requestedUrl,
        'https://gh-calendar.rschristian.dev/user/Adavitas',
    );
    assert.equal(grid.children.length, 3);
    assert.deepEqual(
        grid.children.map((day) => day.dataset.level),
        ['0', '1', '4'],
    );
    assert.equal(grid.classList.contains('is-loading'), false);
    assert.equal(grid.getAttribute('aria-busy'), null);
    assert.equal(status.textContent, '6 contributions in the last year');
    assert.match(grid.getAttribute('aria-label'), /6 GitHub contributions/);
    assert.match(grid.children[2].title, /5 contributions on Jul 21, 2026/);
});

test('GitHub activity keeps a clear fallback when the live request fails', async () => {
    const { document, grid, status } = createGithubActivityDom();

    runMain({
        document,
        fetch: async () => ({ ok: false }),
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(grid.classList.contains('is-loading'), false);
    assert.equal(grid.classList.contains('is-unavailable'), true);
    assert.equal(grid.getAttribute('aria-busy'), null);
    assert.equal(status.textContent, 'Live activity is temporarily unavailable');
});

test('certificate accordion keeps one panel open and supports keyboard navigation', () => {
    const document = new MockDocument();
    const list = appendElement(document, 'div', { className: 'certificate-list' });
    const buttons = [];
    const details = [];
    for (let index = 0; index < 8; index++) {
        buttons.push(appendElement(document, 'button', {
            className: 'certificate-toggle',
            attributes: { 'aria-controls': `proof-${index}`, 'aria-expanded': 'true' },
        }, list));
        details.push(appendElement(document, 'div', { id: `proof-${index}` }));
    }
    runMain({ document });
    function assertSelection(selected) {
        buttons.forEach((button, index) => {
            assert.equal(button.getAttribute('aria-expanded'), String(index === selected));
            assert.equal(details[index].hidden, index !== selected);
            assert.equal(button.disabled, false);
        });
    }
    assertSelection(0);
    buttons[3].dispatchEvent(createEvent('click'));
    assertSelection(3);
    buttons[3].dispatchEvent(createEvent('click'));
    assertSelection(3);
    buttons[3].dispatchEvent(createEvent('keydown', { key: 'End' }));
    assertSelection(7);
    buttons[7].dispatchEvent(createEvent('keydown', { key: 'ArrowRight' }));
    assertSelection(0);
    buttons[0].dispatchEvent(createEvent('keydown', { key: 'ArrowLeft' }));
    assertSelection(7);
    buttons[7].dispatchEvent(createEvent('keydown', { key: 'Home' }));
    assertSelection(0);
});

test('project selection opens full content and persists across section changes', () => {
    const dom = createSectionSwitcherDom();
    runMain({ document: dom.document, locationHash: '#projects' });
    assert.equal(dom.aboutPanel.hidden, true);
    assert.equal(dom.projectsPanel.hidden, false);
    assert.equal(dom.certificatesPanel.hidden, true);
    assert.equal(dom.casePortfolioPanel.hidden, false);
    assert.equal(dom.caseMinishellPanel.hidden, true);
    assert.equal(dom.casePortfolioLink.getAttribute('aria-current'), 'true');
    dom.caseMinishellPanel.scrollTop = 100;
    dom.caseMinishellLink.dispatchEvent(createEvent('click'));
    assert.equal(dom.projectsPanel.hidden, false);
    assert.equal(dom.casePortfolioPanel.hidden, true);
    assert.equal(dom.caseMinishellPanel.hidden, false);
    assert.equal(dom.caseMinishellPanel.scrollTop, 0);
    assert.equal(dom.caseMinishellLink.getAttribute('aria-current'), 'true');
    assert.equal(dom.casePortfolioLink.getAttribute('aria-current'), null);
    assert.equal(dom.projectsLink.getAttribute('aria-current'), 'page');
    assert.equal(dom.document.documentElement.dataset.activeSection, 'projects');
    dom.certificatesLink.dispatchEvent(createEvent('click'));
    assert.equal(dom.projectsPanel.hidden, true);
    assert.equal(dom.caseMinishellPanel.hidden, true);
    assert.equal(dom.certificatesPanel.hidden, false);
    dom.projectsLink.dispatchEvent(createEvent('click'));
    assert.equal(dom.caseMinishellPanel.hidden, false);
    assert.equal(dom.certificatesPanel.hidden, true);
});

test('project hashes load directly and browser history restores the selected project', () => {
    const dom = createSectionSwitcherDom();
    const run = runMain({ document: dom.document, locationHash: '#case-minishell' });
    assert.equal(dom.caseMinishellPanel.hidden, false);
    assert.equal(dom.projectsPanel.hidden, false);
    assert.equal(dom.projectsLink.getAttribute('aria-current'), 'page');
    run.window.location.hash = '#case-portfolio';
    run.window.dispatchEvent(createEvent('hashchange'));
    assert.equal(dom.casePortfolioPanel.hidden, false);
    assert.equal(dom.caseMinishellPanel.hidden, true);
    assert.equal(dom.casePortfolioLink.getAttribute('aria-current'), 'true');
    run.window.location.hash = '#unknown-project';
    run.window.dispatchEvent(createEvent('hashchange'));
    assert.equal(dom.aboutPanel.hidden, false);
    assert.equal(dom.projectsPanel.hidden, true);
});

test('project keyboard navigation moves focus without changing selection', () => {
    const dom = createSectionSwitcherDom();
    const run = runMain({ document: dom.document, locationHash: '#projects' });
    dom.casePortfolioLink.dispatchEvent(createEvent('keydown', { key: 'End' }));
    assert.equal(dom.document.activeElement, dom.caseMinishellLink);
    assert.equal(dom.casePortfolioPanel.hidden, false);
    assert.deepEqual(run.historyPushes, []);
    dom.caseMinishellLink.dispatchEvent(createEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(dom.document.activeElement, dom.casePortfolioLink);
    dom.casePortfolioLink.dispatchEvent(createEvent('keydown', { key: 'ArrowLeft' }));
    assert.equal(dom.document.activeElement, dom.caseMinishellLink);
    dom.caseMinishellLink.dispatchEvent(createEvent('click', { ctrlKey: true }));
    assert.deepEqual(run.historyPushes, []);
    assert.equal(dom.casePortfolioPanel.hidden, false);
});

test('section links do not add duplicate entries for the current hash', () => {
    const dom = createSectionSwitcherDom();
    const run = runMain({ document: dom.document, locationHash: '#projects' });

    dom.projectsLink.dispatchEvent(createEvent('click'));

    assert.deepEqual(run.historyPushes, []);
    assert.equal(dom.projectsPanel.scrollIntoViewCalls.length, 1);

    dom.casePortfolioLink.dispatchEvent(createEvent('click'));
    dom.casePortfolioLink.dispatchEvent(createEvent('click'));

    assert.deepEqual(run.historyPushes, ['#case-portfolio']);
});

test('home section switcher respects reduced motion when scrolling clicked panel', () => {
    const dom = createSectionSwitcherDom();
    const media = createMatchMediaController({
        '(prefers-reduced-motion: reduce)': true,
    });

    runMain({ document: dom.document, media });
    dom.projectsLink.dispatchEvent(createEvent('click'));

    assert.equal(dom.projectsPanel.scrollIntoViewCalls.length, 1);
    assert.equal(dom.projectsPanel.scrollIntoViewCalls[0].block, 'start');
    assert.equal(dom.projectsPanel.scrollIntoViewCalls[0].behavior, 'auto');
});

test('card reveals observe targets and disconnect after the final reveal', () => {
    const { document, revealElements } = createRevealDom(2);
    const intersectionObserver = createIntersectionObserverMock();

    runMain({ document, intersectionObserver });

    assert.equal(document.documentElement.classList.contains('reveal-enabled'), true);
    assert.equal(intersectionObserver.observers.length, 1);

    const [observer] = intersectionObserver.observers;
    assert.deepEqual(observer.observed, revealElements);
    assert.equal(observer.options.rootMargin, '0px 0px -8% 0px');
    assert.equal(observer.options.threshold, 0.12);

    observer.trigger([{ target: revealElements[0], isIntersecting: true }]);

    assert.equal(revealElements[0].classList.contains('is-visible'), true);
    assert.deepEqual(observer.unobserved, [revealElements[0]]);
    assert.equal(observer.disconnected, false);

    observer.trigger([{ target: revealElements[1], isIntersecting: true }]);

    assert.equal(revealElements[1].classList.contains('is-visible'), true);
    assert.equal(observer.disconnected, true);
});

test('fine-pointer spotlight tracks pointer position and clears it on leave', () => {
    const document = new MockDocument();
    const spotlightCard = appendElement(document, 'article', {
        className: 'card-spotlight',
    });
    spotlightCard.boundingClientRect = {
        left: 10,
        top: 20,
        width: 200,
        height: 100,
    };
    const media = createMatchMediaController({ '(pointer: fine)': true });

    runMain({ document, media });
    spotlightCard.dispatchEvent(
        createEvent('pointermove', { clientX: 110, clientY: 45 }),
    );

    assert.equal(spotlightCard.style.getPropertyValue('--spotlight-x'), '50%');
    assert.equal(spotlightCard.style.getPropertyValue('--spotlight-y'), '25%');

    spotlightCard.dispatchEvent(createEvent('pointerleave'));

    assert.equal(spotlightCard.style.getPropertyValue('--spotlight-x'), '');
    assert.equal(spotlightCard.style.getPropertyValue('--spotlight-y'), '');
});

test('coarse pointers do not install spotlight movement listeners', () => {
    const document = new MockDocument();
    const spotlightCard = appendElement(document, 'article', {
        className: 'card-spotlight',
    });

    runMain({ document });

    assert.equal(spotlightCard.eventListeners.has('pointermove'), false);
    assert.equal(spotlightCard.eventListeners.has('pointerleave'), false);
});

test('card reveals do not start when reduced motion is already requested', () => {
    const { document } = createRevealDom(1);
    const intersectionObserver = createIntersectionObserverMock();
    const media = createMatchMediaController({
        '(prefers-reduced-motion: reduce)': true,
    });

    runMain({ document, intersectionObserver, media });

    assert.equal(document.documentElement.classList.contains('reveal-enabled'), false);
    assert.equal(intersectionObserver.observers.length, 0);
});

test('changing to reduced motion removes reveal state and disconnects observer', () => {
    const { document } = createRevealDom(1);
    const intersectionObserver = createIntersectionObserverMock();
    const media = createMatchMediaController({
        '(prefers-reduced-motion: reduce)': false,
    });

    runMain({ document, intersectionObserver, media });
    const [observer] = intersectionObserver.observers;

    media.set('(prefers-reduced-motion: reduce)', true);

    assert.equal(observer.disconnected, true);
    assert.equal(document.documentElement.classList.contains('reveal-enabled'), false);
});

test('missing IntersectionObserver leaves reveal content visible', () => {
    const { document, revealElements } = createRevealDom(1);

    runMain({ document });

    assert.equal(document.documentElement.classList.contains('reveal-enabled'), false);
    assert.equal(revealElements[0].classList.contains('is-visible'), false);
});

test('timezone clock writes visible text and machine-readable datetimes', () => {
    const dom = createTimezoneDom();
    const fixedIso = '2026-06-25T20:30:40.000Z';
    const storage = createStorage();

    class FixedDate extends Date {
        constructor(...args) {
            if (args.length === 0) {
                super(fixedIso);
            } else {
                super(...args);
            }
        }

        static now() {
            return new Date(fixedIso).getTime();
        }
    }

    const { timeouts } = runMain({
        document: dom.document,
        DateConstructor: FixedDate,
        storage,
    });
    const expectedHomeTime24 = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        hour12: false,
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
    }).format(new FixedDate());
    const expectedHomeTime12 = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        hour12: true,
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
    }).format(new FixedDate());

    assert.equal(dom.homeTime.textContent, expectedHomeTime24);
    assert.ok(dom.visitorTime.textContent);
    assert.ok(dom.homeTimezoneLabel.textContent);
    assert.ok(dom.visitorTimezoneLabel.textContent);
    assert.equal(dom.twentyFourHourButton.getAttribute('aria-pressed'), 'true');
    assert.equal(dom.twelveHourButton.getAttribute('aria-pressed'), 'false');
    assert.equal(dom.timeFormatControl.hidden, false);
    assert.equal(dom.document.documentElement.dataset.timeFormat, '24');
    assert.equal(dom.homeTime.dateTime, fixedIso);
    assert.equal(dom.visitorTime.dateTime, fixedIso);
    assert.equal(Date.parse(dom.homeTime.dateTime), FixedDate.now());
    assert.equal(Date.parse(dom.visitorTime.dateTime), FixedDate.now());
    assert.equal(timeouts[0].delay, 20000);

    timeouts[0].callback();

    assert.equal(timeouts.length, 2);
    assert.equal(timeouts[1].delay, 20000);

    dom.twelveHourButton.dispatchEvent(createEvent('click'));

    assert.equal(dom.homeTime.textContent, expectedHomeTime12);
    assert.equal(dom.twelveHourButton.getAttribute('aria-pressed'), 'true');
    assert.equal(dom.twentyFourHourButton.getAttribute('aria-pressed'), 'false');
    assert.equal(dom.document.documentElement.dataset.timeFormat, '12');
    assert.equal(storage.valueFor('portfolio-time-format'), '12');
});

test('missing optional timezone and palette markup does not throw', () => {
    assert.doesNotThrow(() => runMain({ document: new MockDocument() }));
    assert.doesNotThrow(() =>
        runMain({ document: createTimezoneDom({ withoutFormatButtons: true }).document }),
    );
});
