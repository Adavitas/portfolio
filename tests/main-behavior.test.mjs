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
        this._className = '';
        this.classList = new MockClassList(this);

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
    const intervals = [];
    const window = {
        matchMedia: media.matchMedia,
    };

    const context = {
        console,
        document,
        window,
        localStorage: storage,
        setInterval(callback, delay) {
            intervals.push({ callback, delay });
            return intervals.length;
        },
        Date: options.DateConstructor ?? Date,
        Intl,
        encodeURIComponent,
    };

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
        intervals,
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

function createNavigationDom() {
    const document = new MockDocument();
    const button = appendElement(document, 'button', {
        className: 'menu-button',
        attributes: {
            'aria-expanded': 'false',
            'aria-controls': 'nav-links',
        },
    });
    const label = appendElement(
        document,
        'span',
        { className: 'menu-button-label' },
        button,
    );
    const navigation = appendElement(document, 'ul', {
        id: 'nav-links',
        className: 'nav-links',
    });
    const firstLink = appendElement(document, 'a', {}, navigation);
    const secondLink = appendElement(document, 'a', {}, navigation);

    return {
        document,
        button,
        label,
        navigation,
        firstLink,
        secondLink,
    };
}

function createContactDom() {
    const document = new MockDocument();
    const contactForm = appendElement(document, 'form', { id: 'contact-form' });
    const nameInput = appendElement(document, 'input', { id: 'name' }, contactForm);
    const emailInput = appendElement(
        document,
        'input',
        { id: 'email' },
        contactForm,
    );
    const messageInput = appendElement(
        document,
        'textarea',
        { id: 'message' },
        contactForm,
    );
    const nameError = appendElement(document, 'p', { id: 'name-error' });
    const emailError = appendElement(document, 'p', { id: 'email-error' });
    const messageError = appendElement(document, 'p', { id: 'message-error' });
    const formStatus = appendElement(document, 'p', {
        id: 'form-status',
        className: 'form-status',
    });
    const emailDraftLink = appendElement(document, 'a', {
        id: 'email-draft-link',
        className: 'email-draft-link',
    });
    emailDraftLink.hidden = true;

    return {
        document,
        contactForm,
        nameInput,
        emailInput,
        messageInput,
        nameError,
        emailError,
        messageError,
        formStatus,
        emailDraftLink,
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

function createProjectFilterDom() {
    const document = new MockDocument();
    const status = appendElement(document, 'p', { id: 'project-filter-status' });
    const allButton = appendElement(document, 'button', {
        className: 'project-filter-button is-active',
        attributes: {
            'aria-pressed': 'true',
            'data-project-filter': 'all',
        },
    });
    allButton.textContent = 'All';

    const frontendButton = appendElement(document, 'button', {
        className: 'project-filter-button',
        attributes: {
            'aria-pressed': 'false',
            'data-project-filter': 'frontend',
        },
    });
    frontendButton.textContent = 'Frontend';

    const systemsButton = appendElement(document, 'button', {
        className: 'project-filter-button',
        attributes: {
            'aria-pressed': 'false',
            'data-project-filter': 'systems',
        },
    });
    systemsButton.textContent = 'Systems';

    const frontendProject = appendElement(document, 'article', {
        className: 'project-card',
        attributes: {
            'data-project-categories': 'frontend accessibility javascript',
        },
    });
    const systemsProject = appendElement(document, 'article', {
        className: 'project-card',
        attributes: {
            'data-project-categories': 'systems c unix parsing',
        },
    });

    return {
        document,
        status,
        allButton,
        frontendButton,
        systemsButton,
        frontendProject,
        systemsProject,
    };
}

function createTimezoneDom() {
    const document = new MockDocument();
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

    return {
        document,
        homeTime,
        visitorTime,
        homeTimezoneLabel,
        visitorTimezoneLabel,
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

test('mobile navigation toggles, closes from links, and closes with Escape', () => {
    const { document, button, label, navigation, firstLink } = createNavigationDom();

    runMain({ document });

    button.dispatchEvent(createEvent('click'));

    assert.equal(navigation.classList.contains('is-open'), true);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(label.textContent, 'Close');

    firstLink.dispatchEvent(createEvent('click'));

    assert.equal(navigation.classList.contains('is-open'), false);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(label.textContent, 'Menu');

    button.dispatchEvent(createEvent('click'));
    document.dispatchEvent(createEvent('keydown', { key: 'Escape' }));

    assert.equal(navigation.classList.contains('is-open'), false);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, button);
});

test('desktop breakpoint resets mobile navigation state', () => {
    const { document, button, navigation } = createNavigationDom();
    const media = createMatchMediaController({
        '(min-width: 700px)': false,
    });

    runMain({ document, media });
    button.dispatchEvent(createEvent('click'));

    assert.equal(navigation.classList.contains('is-open'), true);

    media.set('(min-width: 700px)', true);

    assert.equal(navigation.classList.contains('is-open'), false);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('project filter toggles cards, button state, and live status', () => {
    const dom = createProjectFilterDom();

    runMain({ document: dom.document });
    dom.frontendButton.dispatchEvent(createEvent('click'));

    assert.equal(dom.frontendProject.hidden, false);
    assert.equal(dom.systemsProject.hidden, true);
    assert.equal(dom.allButton.getAttribute('aria-pressed'), 'false');
    assert.equal(dom.frontendButton.getAttribute('aria-pressed'), 'true');
    assert.equal(dom.status.textContent, 'Showing 1 frontend project.');

    dom.systemsButton.dispatchEvent(createEvent('click'));

    assert.equal(dom.frontendProject.hidden, true);
    assert.equal(dom.systemsProject.hidden, false);
    assert.equal(dom.frontendButton.getAttribute('aria-pressed'), 'false');
    assert.equal(dom.systemsButton.getAttribute('aria-pressed'), 'true');
    assert.equal(dom.status.textContent, 'Showing 1 systems project.');

    dom.allButton.dispatchEvent(createEvent('click'));

    assert.equal(dom.frontendProject.hidden, false);
    assert.equal(dom.systemsProject.hidden, false);
    assert.equal(dom.allButton.getAttribute('aria-pressed'), 'true');
    assert.equal(dom.status.textContent, 'Showing all 2 projects.');
});

test('empty contact form submission exposes required errors and focuses first field', () => {
    const dom = createContactDom();

    runMain({ document: dom.document });
    dom.contactForm.dispatchEvent(createEvent('submit'));

    assert.equal(dom.contactForm.noValidate, true);
    assert.equal(dom.nameError.textContent, 'Enter a name with at least two characters.');
    assert.equal(dom.emailError.textContent, 'Enter your email address.');
    assert.equal(
        dom.messageError.textContent,
        'Write a message with at least 20 characters.',
    );
    assert.equal(dom.formStatus.textContent, 'Please correct the highlighted fields.');
    assert.equal(dom.formStatus.classList.contains('is-error'), true);
    assert.equal(dom.document.activeElement, dom.nameInput);
});

test('contact form rejects malformed email addresses', () => {
    const dom = createContactDom();
    dom.nameInput.value = 'Ada';
    dom.emailInput.value = 'not-an-email';
    dom.emailInput.validity.valid = false;
    dom.messageInput.value = 'This message is long enough.';

    runMain({ document: dom.document });
    dom.contactForm.dispatchEvent(createEvent('submit'));

    assert.equal(
        dom.emailError.textContent,
        'Enter an email address in the format name@example.com.',
    );
    assert.equal(dom.document.activeElement, dom.emailInput);
});

test('contact form treats whitespace as empty content', () => {
    const dom = createContactDom();
    dom.nameInput.value = '   ';
    dom.emailInput.value = '   ';
    dom.messageInput.value = '                    ';

    runMain({ document: dom.document });
    dom.contactForm.dispatchEvent(createEvent('submit'));

    assert.equal(dom.nameError.textContent, 'Enter a name with at least two characters.');
    assert.equal(dom.emailError.textContent, 'Enter your email address.');
    assert.equal(
        dom.messageError.textContent,
        'Write a message with at least 20 characters.',
    );
});

test('valid contact form data creates an encoded mailto draft', () => {
    const dom = createContactDom();
    dom.nameInput.value = 'Ada Lovelace';
    dom.emailInput.value = 'ada@example.com';
    dom.emailInput.validity.valid = true;
    dom.messageInput.value = 'I would like to discuss a portfolio opportunity.';

    runMain({ document: dom.document });
    dom.contactForm.dispatchEvent(createEvent('submit'));

    assert.equal(dom.emailDraftLink.hidden, false);
    assert.match(
        dom.emailDraftLink.href,
        /^mailto:leqso\.davitashvili\.st@gmail\.com\?subject=Portfolio%20enquiry%20from%20Ada%20Lovelace&body=/,
    );
    assert.match(dom.emailDraftLink.href, /Email%3A%20ada%40example\.com/);
    assert.match(dom.formStatus.textContent, /ready/i);
    assert.doesNotMatch(dom.formStatus.textContent, /\bsent\b/i);
    assert.equal(dom.formStatus.classList.contains('is-success'), true);
    assert.equal(dom.document.activeElement, dom.emailDraftLink);
});

test('editing a contact field clears stale draft state', () => {
    const dom = createContactDom();
    dom.nameInput.value = 'Ada Lovelace';
    dom.emailInput.value = 'ada@example.com';
    dom.messageInput.value = 'I would like to discuss a portfolio opportunity.';

    runMain({ document: dom.document });
    dom.contactForm.dispatchEvent(createEvent('submit'));

    assert.equal(dom.emailDraftLink.hidden, false);

    dom.messageInput.dispatchEvent(createEvent('input'));

    assert.equal(dom.formStatus.textContent, '');
    assert.equal(dom.formStatus.className, 'form-status');
    assert.equal(dom.emailDraftLink.hidden, true);
    assert.equal(dom.emailDraftLink.getAttribute('href'), null);
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

    const { intervals } = runMain({
        document: dom.document,
        DateConstructor: FixedDate,
    });

    assert.ok(dom.homeTime.textContent);
    assert.ok(dom.visitorTime.textContent);
    assert.ok(dom.homeTimezoneLabel.textContent);
    assert.ok(dom.visitorTimezoneLabel.textContent);
    assert.equal(dom.homeTime.dateTime, fixedIso);
    assert.equal(dom.visitorTime.dateTime, fixedIso);
    assert.equal(Date.parse(dom.homeTime.dateTime), FixedDate.now());
    assert.equal(Date.parse(dom.visitorTime.dateTime), FixedDate.now());
    assert.equal(intervals[0].delay, 60000);
});

test('missing optional timezone and palette markup does not throw', () => {
    assert.doesNotThrow(() => runMain({ document: new MockDocument() }));
});
