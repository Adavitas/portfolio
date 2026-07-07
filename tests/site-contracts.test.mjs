import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);

const pages = [
    {
        file: 'index.html',
        cssPrefix: '',
        scriptPrefix: '',
    },
];

const cssFiles = [
    'css/reset.css',
    'css/tokens.css',
    'css/base.css',
    'css/layout.css',
    'css/components.css',
    'css/sections.css',
    'css/responsive.css',
    'css/motion.css',
];

const expectedStylesheetHrefs = cssFiles.map((file) =>
    file === 'css/reset.css' ? file : `${file}?v=split-scroll`,
);

const requiredAssets = [
    'assets/images/favicon.svg',
    'assets/images/portrait.jpeg',
    'assets/images/portfolio-preview.svg',
    'assets/images/minishell-preview.svg',
    'assets/images/push-swap-preview.svg',
];

const pageSources = new Map(
    await Promise.all(
        pages.map(async ({ file }) => [
            file,
            await readFile(path.join(rootDirectory, file), 'utf8'),
        ]),
    ),
);
const cssSources = new Map(
    await Promise.all(
        cssFiles.map(async (file) => [
            file,
            await readFile(path.join(rootDirectory, file), 'utf8'),
        ]),
    ),
);
const styleSource = (
    cssFiles
        .filter((file) => file !== 'css/reset.css')
        .map((file) => cssSources.get(file))
).join('\n');

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAttribute(tag, name) {
    const match = tag.match(
        new RegExp(`\\b${escapeRegex(name)}\\s*=\\s*(['"])(.*?)\\1`, 'i'),
    );

    return match ? match[2] : null;
}

function getTags(source, tagName) {
    return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map(
        ([tag]) => tag,
    );
}

function getElementText(source, tagName) {
    return [
        ...source.matchAll(
            new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi'),
        ),
    ].map(([, text]) => stripTags(text));
}

function stripTags(value) {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripCssCommentsAndStrings(value) {
    return value
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
}

function getIds(source) {
    return [...source.matchAll(/\bid\s*=\s*(['"])(.*?)\1/gi)].map(
        ([, , id]) => id,
    );
}

function getIdSet(file) {
    return new Set(getIds(pageSources.get(file)));
}

function isExternalUrl(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
}

function resolveLocalReference(fromFile, value) {
    const [rawPath, fragment = ''] = value.split('#');
    const [pathWithoutQuery] = rawPath.split('?');
    const targetFile = pathWithoutQuery
        ? path.posix.normalize(
              path.posix.join(path.posix.dirname(fromFile), pathWithoutQuery),
          )
        : fromFile;

    return {
        targetFile,
        fragment,
    };
}

async function assertFileExists(file) {
    await access(path.join(rootDirectory, file));
}

async function assertLocalFileReferenceExists(fromFile, value) {
    if (!value || value.startsWith('#') || isExternalUrl(value)) {
        return;
    }

    const { targetFile } = resolveLocalReference(fromFile, value);
    assert.ok(
        !targetFile.startsWith('..'),
        `${fromFile} references a path outside the project: ${value}`,
    );

    await assertFileExists(targetFile);
}

function assertFragmentTargetExists(fromFile, value) {
    if (!value || isExternalUrl(value) || !value.includes('#')) {
        return;
    }

    const { targetFile, fragment } = resolveLocalReference(fromFile, value);

    if (!fragment) {
        return;
    }

    const targetSource = pageSources.get(targetFile);
    assert.ok(
        targetSource,
        `${fromFile} links to a fragment in a page that is not tracked: ${value}`,
    );

    assert.ok(
        getIdSet(targetFile).has(fragment),
        `${fromFile} links to missing fragment #${fragment} in ${targetFile}`,
    );
}

function countOccurrences(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('development tooling remains dependency-free', async () => {
    const packageSource = await readFile(
        path.join(rootDirectory, 'package.json'),
        'utf8',
    );
    const packageData = JSON.parse(packageSource);

    assert.equal(packageData.private, true);
    assert.equal(packageData.scripts?.test, 'node --test');
    assert.equal(packageData.scripts?.check, 'node scripts/check.mjs');
    assert.equal(packageData.dependencies, undefined);
    assert.equal(packageData.devDependencies, undefined);

    for (const lockfile of [
        'package-lock.json',
        'npm-shrinkwrap.json',
        'yarn.lock',
        'pnpm-lock.yaml',
    ]) {
        await assert.rejects(
            access(path.join(rootDirectory, lockfile)),
            { code: 'ENOENT' },
            `${lockfile} should not exist because this project has no packages`,
        );
    }
});

test('required pages exist', async () => {
    for (const { file } of pages) {
        await assertFileExists(file);
    }

    for (const deletedPage of [
        'projects/portfolio.html',
        'projects/minishell.html',
        'projects/push-swap.html',
    ]) {
        await assert.rejects(
            access(path.join(rootDirectory, deletedPage)),
            { code: 'ENOENT' },
            `${deletedPage} should stay deleted because case studies live in index.html`,
        );
    }
});

test('required assets exist and the unused event photograph stays deleted', async () => {
    for (const asset of requiredAssets) {
        await assertFileExists(asset);
    }

    await assert.rejects(
        access(path.join(rootDirectory, 'css/style.css')),
        { code: 'ENOENT' },
        'style.css should stay deleted after the responsibility-based CSS split',
    );

    await assert.rejects(
        access(path.join(rootDirectory, 'assets/images/20260417_pz_5636.jpg')),
        { code: 'ENOENT' },
    );
});

test('css files keep valid block structure', () => {
    for (const [file, source] of cssSources) {
        let depth = 0;

        for (const character of stripCssCommentsAndStrings(source)) {
            if (character === '{') {
                depth += 1;
            }

            if (character === '}') {
                depth -= 1;
            }

            assert.ok(depth >= 0, `${file} has an extra closing brace`);
        }

        assert.equal(depth, 0, `${file} has an unclosed CSS block`);
    }

    assert.match(
        cssSources.get('css/responsive.css'),
        /@media\s*\(min-width:\s*900px\)/,
        'responsive.css should own desktop breakpoint overrides so they load after base section rules',
    );
});

test('page metadata is present, unique, and not pretending to be deployed', () => {
    const titles = [];
    const descriptions = [];

    for (const { file } of pages) {
        const source = pageSources.get(file);
        const titleMatches = [
            ...source.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi),
        ];
        const descriptionTags = getTags(source, 'meta').filter(
            (tag) => getAttribute(tag, 'name') === 'description',
        );

        assert.equal(titleMatches.length, 1, `${file} needs exactly one title`);
        assert.equal(
            descriptionTags.length,
            1,
            `${file} needs exactly one description`,
        );

        const title = stripTags(titleMatches[0][1]);
        const description = getAttribute(descriptionTags[0], 'content') ?? '';

        assert.ok(title, `${file} title cannot be empty`);
        assert.ok(description, `${file} description cannot be empty`);
        titles.push(title);
        descriptions.push(description);

        assert.doesNotMatch(source, /\blocalhost\b|127\.0\.0\.1|0\.0\.0\.0/i);
        assert.doesNotMatch(source, /<link\b[^>]*rel=["']canonical["']/i);
        assert.doesNotMatch(source, /property=["']og:url["']/i);
        assert.doesNotMatch(source, /property=["']og:image["']/i);
    }

    assert.equal(new Set(titles).size, titles.length, 'page titles must be unique');
    assert.equal(
        new Set(descriptions).size,
        descriptions.length,
        'page descriptions must be unique',
    );
});

test('document structure is consistent on every page', () => {
    for (const { file, cssPrefix, scriptPrefix } of pages) {
        const source = pageSources.get(file);

        assert.match(source, /<html\b[^>]*lang=["']en["']/i);
        assert.equal(
            countOccurrences(source, /<main\b[^>]*id=["']main-content["'][^>]*>/gi),
            1,
            `${file} needs one main landmark with id main-content`,
        );
        assert.doesNotMatch(
            source,
            /\bskip-link\b/i,
            `${file} should not restore the removed skip-link class`,
        );
        assert.doesNotMatch(
            source,
            /\bclass=["'][^"']*\blogo\b/i,
            `${file} should not restore the removed logo nav class`,
        );
        assert.equal(
            countOccurrences(source, /<h1\b/gi),
            1,
            `${file} needs one page-level h1`,
        );
        const loadedStylesheetHrefs = getTags(source, 'link')
            .filter((tag) => getAttribute(tag, 'rel') === 'stylesheet')
            .map((tag) => getAttribute(tag, 'href'));
        assert.deepEqual(
            loadedStylesheetHrefs,
            expectedStylesheetHrefs.map((stylesheet) => `${cssPrefix}${stylesheet}`),
            `${file} should load CSS files in the documented cascade order`,
        );
        assert.match(
            source,
            new RegExp(
                `<script\\b[^>]*src=["']${escapeRegex(
                    `${scriptPrefix}js/theme-init.js`,
                )}["']`,
                'i',
            ),
        );
        assert.match(
            source,
            new RegExp(
                `<script\\b(?=[^>]*src=["']${escapeRegex(
                    `${scriptPrefix}js/main.js`,
                )}(?:\\?[^"']*)?["'])(?=[^>]*\\bdefer\\b)`,
                'i',
            ),
        );
    }
});

test('home section panels share one outer layout contract', () => {
    assert.match(
        styleSource,
        /--section-panel-block-size:\s*clamp\(/,
        'shared section panel height token should stay centralized',
    );

    const panelRule = styleSource.match(/\[data-section-panel\]\s*{([\s\S]*?)\n}/);
    assert.ok(panelRule, 'data-section-panel needs a shared sizing rule');

    assert.ok(
        styleSource.indexOf('[data-section-panel]') >
            styleSource.indexOf('.card {'),
        'section panel overflow must load after .card overflow so active panels can scroll internally',
    );

    for (const [property, value] of [
        ['inline-size', '100%'],
        ['block-size', 'var(--section-panel-block-size)'],
        ['overflow-x', 'hidden'],
        ['overflow-y', 'auto'],
        ['overscroll-behavior', 'contain'],
        ['scrollbar-gutter', 'stable'],
    ]) {
        assert.match(
            panelRule[1],
            new RegExp(`${property}\\s*:\\s*${escapeRegex(value)}\\s*;`),
            `section panel rule should include ${property}: ${value}`,
        );
    }

    assert.match(
        styleSource,
        /#contact-form\s*{[\s\S]*?width:\s*min\(100%,\s*44rem\);[\s\S]*?margin:\s*1\.5rem auto 0;/,
        'contact form should stay readable inside the full-width contact panel',
    );
    assert.match(
        styleSource,
        /\.projects-card,\s*\n\s*\.certificates-card,\s*\n\s*\.case-panel,\s*\n\s*\.contact-card\s*{[\s\S]*?order:\s*2;[\s\S]*?}/,
        'Projects, Certificates, case studies, and Contact should share the same main-panel order',
    );
    assert.match(
        styleSource,
        /\.intro-card\s*{[\s\S]*?order:\s*2;[\s\S]*?}/,
        'About should use the same main-panel order as the other section panels',
    );
    assert.match(
        styleSource,
        /@media \(max-width: 899px\) {[\s\S]*?\.section-switcher\s*{[\s\S]*?order:\s*1;[\s\S]*?\.rail-appearance-card\s*{[\s\S]*?order:\s*3;[\s\S]*?\.rail-credit-card\s*{[\s\S]*?order:\s*4;[\s\S]*?}/,
        'small screens should order section controls before panels, then appearance controls and credits',
    );
    assert.match(
        styleSource,
        /@media \(min-width: 900px\) {[\s\S]*?\.intro-card,\s*\n\s*\.projects-card,\s*\n\s*\.certificates-card,\s*\n\s*\.case-panel,\s*\n\s*\.contact-card,\s*\n\s*\.info-grid\s*{[\s\S]*?grid-column:\s*1 \/ 13;/,
        'Certificates and case studies should share the same desktop width as the other main panels',
    );
    assert.doesNotMatch(
        styleSource,
        /\.skip-link\b/i,
        'removed skip-link styles should not remain in CSS',
    );
    assert.doesNotMatch(
        styleSource,
        /\.logo\b/i,
        'removed logo nav styles should not remain in CSS',
    );
    assert.doesNotMatch(
        styleSource,
        /\.menu-button\b|\.nav-actions\b|\.nav-links\b/i,
        'removed standalone page navigation styles should not remain in CSS',
    );
    assert.doesNotMatch(
        styleSource,
        /\.case-study-page\b|\.case-study-back-link\b|\.case-study-navigation\b/i,
        'removed standalone case-study page styles should not remain in CSS',
    );
    assert.doesNotMatch(
        styleSource,
        /\bfooter\b/i,
        'removed standalone page footer styles should not remain in CSS',
    );
});

test('home persistent info cards stay compact below the active panel', () => {
    assert.match(
        styleSource,
        /--persistent-info-card-block-size:\s*9rem;/,
        'copyright, Now, Time, and contact-link cards should share one compact height token',
    );

    const infoGridRule = styleSource.match(/\.info-grid\s*{([\s\S]*?)\n}/);
    assert.ok(infoGridRule, 'info-grid needs a base layout rule');
    assert.match(
        infoGridRule[1],
        /align-items:\s*stretch;/,
        'persistent info cards should stretch to matching card heights',
    );

    const desktopRailRule = styleSource.match(
        /@media \(min-width: 900px\) {[\s\S]*?\.section-rail\s*{([\s\S]*?)\n  }/,
    );
    assert.ok(desktopRailRule, 'desktop section rail rule should exist');
    assert.match(
        desktopRailRule[1],
        /grid-row:\s*1 \/ 3;/,
        'desktop rail should span the active panel row and the aligned credit row',
    );
    assert.match(
        desktopRailRule[1],
        /block-size:\s*calc\(\s*var\(--section-panel-block-size\)\s*\+\s*var\(--grid-gap\)\s*\+\s*var\(--persistent-info-card-block-size\)\s*\);/,
        'desktop rail should reserve active panel height, one grid gap, and the credit row height',
    );
    assert.match(
        desktopRailRule[1],
        /grid-template-rows:\s*auto minmax\(0,\s*1fr\) var\(\s*--persistent-info-card-block-size\s*\);/,
        'desktop rail should keep sections and appearance above a fixed-height credit row',
    );

    assert.match(
        styleSource,
        /\.rail-credit-card,\s*\n\s*\.info-grid > \.card\s*{[\s\S]*?block-size:\s*var\(--persistent-info-card-block-size\);[\s\S]*?}/,
        'copyright, Now, Time, and contact-link cards should share the same desktop height',
    );
    assert.match(
        styleSource,
        /@media \(min-width: 900px\) {[\s\S]*?\.info-grid\s*{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[\s\S]*?}/,
        'desktop info grid should use four tracks for a 2/1/1 left-side split',
    );
    assert.match(
        styleSource,
        /#now\s*{[\s\S]*?grid-column:\s*span 2;[\s\S]*?}/,
        'desktop Now card should keep half of the left persistent info row',
    );
    assert.match(
        styleSource,
        /\.time-card,\s*\n\s*\.connect-card\s*{[\s\S]*?grid-column:\s*span 1;[\s\S]*?}/,
        'desktop Time and contact-link cards should each use one quarter of the left row',
    );
    assert.match(
        styleSource,
        /\.credit-stack\s*{[\s\S]*?color:\s*var\(--primary-color\);[\s\S]*?}/,
        'credit stack text should follow the selected accent color',
    );
    assert.match(
        styleSource,
        /@media \(max-width: 899px\) {[\s\S]*?\.section-rail\s*{[\s\S]*?display:\s*contents;[\s\S]*?\.rail-credit-card\s*{[\s\S]*?order:\s*4;[\s\S]*?}/,
        'small screens should place the credits card after persistent info cards',
    );
    assert.match(
        styleSource,
        /\.time-card \.timezone-list\s*{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?}/,
        'desktop time card should place Wolfsburg and visitor time side by side',
    );
    assert.match(
        styleSource,
        /\.time-card \.timezone-value time\s*{[\s\S]*?font-size:\s*clamp\(1\.2rem,\s*2vw,\s*1\.55rem\);[\s\S]*?}/,
        'side-by-side desktop times should use a compact type size',
    );
});

test('card spotlight glow follows the selected accent token', () => {
    assert.match(
        styleSource,
        /\.card-spotlight::before\s*{[\s\S]*?radial-gradient\([\s\S]*?var\(--primary-focus-color\)[\s\S]*?transparent 30%[\s\S]*?}/,
        'mouse-follow card spotlight should use the accent-aware focus color token',
    );
    assert.doesNotMatch(
        styleSource,
        /\.card-spotlight::before\s*{[\s\S]*?rgb\(154 219 200 \/ 18%\)[\s\S]*?}/,
        'mouse-follow card spotlight should not hardcode the old mint glow color',
    );
    assert.match(
        pageSources.get('index.html'),
        /<nav\b(?=[^>]*class=["'][^"']*\bsection-switcher\b)(?=[^>]*class=["'][^"']*\bcard-spotlight\b)/i,
        'section switcher should use the same mouse-follow spotlight behavior as other rail boxes',
    );
    assert.doesNotMatch(
        styleSource,
        /\.card-spotlight:focus-within::before\b/,
        'card spotlight should not stay visible only because a clicked control keeps focus',
    );
});

test('home time card exposes accent-aware format controls', () => {
    const source = pageSources.get('index.html');

    assert.match(
        source,
        /<script\b(?=[^>]*src=["']js\/main\.js\?v=same-shell-cases["'])(?=[^>]*\bdefer\b)/i,
        'home page should cache-bust the same-shell case-study behavior',
    );
    assert.doesNotMatch(
        styleSource,
        /\.time-format-buttons::before\b/,
        'time format control should not recreate a decorative dot before the buttons',
    );
    assert.match(
        source,
        /<button\b(?=[^>]*class=["'][^"']*\btime-format-button\b)(?=[^>]*data-time-format=["']24["'])(?=[^>]*aria-pressed=["']true["'])/i,
        'time card should expose 24-hour format as the initial active choice',
    );
    assert.match(
        source,
        /<button\b(?=[^>]*class=["'][^"']*\btime-format-button\b)(?=[^>]*data-time-format=["']12["'])(?=[^>]*aria-pressed=["']false["'])/i,
        'time card should expose 12-hour format as an alternate choice',
    );
    assert.match(
        styleSource,
        /\.time-format-control\s*{[\s\S]*?justify-self:\s*end;[\s\S]*?}/,
        'time format control should stay top-right without overlapping timezone text',
    );
    assert.match(
        styleSource,
        /\.time-format-button\[aria-pressed="true"\]\s*{[\s\S]*?background-color:\s*var\(--primary-color\);[\s\S]*?}/,
        'selected time format should follow the selected accent color',
    );
});

test('internal links, local assets, and fragments resolve', async () => {
    for (const { file } of pages) {
        const source = pageSources.get(file);

        for (const tag of getTags(source, 'a')) {
            const href = getAttribute(tag, 'href');
            await assertLocalFileReferenceExists(file, href);
            assertFragmentTargetExists(file, href);
        }

        for (const tag of [
            ...getTags(source, 'img'),
            ...getTags(source, 'script'),
            ...getTags(source, 'link'),
        ]) {
            const reference = getAttribute(tag, 'src') ?? getAttribute(tag, 'href');
            await assertLocalFileReferenceExists(file, reference);
        }
    }
});

test('external blank links use noopener and noreferrer', () => {
    for (const { file } of pages) {
        const source = pageSources.get(file);

        for (const tag of getTags(source, 'a')) {
            if (getAttribute(tag, 'target') !== '_blank') {
                continue;
            }

            const relTokens = new Set(
                (getAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/),
            );

            assert.ok(relTokens.has('noopener'), `${file} blank link needs noopener`);
            assert.ok(
                relTokens.has('noreferrer'),
                `${file} blank link needs noreferrer`,
            );
        }
    }
});

test('home project card link labels remain specific and unique', () => {
    const source = pageSources.get('index.html');
    const galleryMatch = source.match(
        /<div class=["']grid-gallery["']>([\s\S]*?)<\/section>/i,
    );
    assert.ok(galleryMatch, 'home page should have a project gallery');

    const links = [...galleryMatch[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)];
    const linkTexts = links.map(([, text]) => stripTags(text));

    assert.deepEqual(linkTexts, [
        'Read portfolio case study',
        'View portfolio source',
        'Read Minishell case study',
        'View Minishell source',
        'Read Push Swap case study',
        'View Push Swap source',
    ]);
    assert.equal(new Set(linkTexts).size, linkTexts.length);

    assert.deepEqual(
        links.map(([tag]) => getAttribute(tag, 'href')),
        [
            '#case-portfolio',
            'https://github.com/Adavitas/portfolio',
            '#case-minishell',
            'https://github.com/Adavitas/minishell',
            '#case-push-swap',
            'https://github.com/Adavitas/push_swap',
        ],
    );
    assert.equal(
        links.filter(([tag]) => getAttribute(tag, 'data-panel-link')).length,
        3,
        'case-study project links should switch same-shell panels',
    );
});

test('accessibility references point to existing IDs', () => {
    for (const { file } of pages) {
        const source = pageSources.get(file);
        const ids = getIds(source);
        const idSet = new Set(ids);

        assert.equal(idSet.size, ids.length, `${file} contains duplicate IDs`);

        for (const attr of ['aria-controls', 'aria-describedby', 'aria-labelledby']) {
            for (const [, value] of source.matchAll(
                new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'gi'),
            )) {
                for (const id of value.trim().split(/\s+/)) {
                    assert.ok(idSet.has(id), `${file} ${attr} points to missing #${id}`);
                }
            }
        }

        if (file === 'index.html') {
            const sectionFragments = {
                about: 'hero',
                projects: 'projects',
                certificates: 'certificates',
                contact: 'contact',
            };

            for (const [section, fragment] of Object.entries(sectionFragments)) {
                assert.match(
                    source,
                    new RegExp(
                        `<a\\b(?=[^>]*href=["']#${fragment}["'])(?=[^>]*data-section-link=["']${section}["'])`,
                        'i',
                    ),
                    `home page needs a ${section} side-switcher link`,
                );
                assert.match(
                    source,
                    new RegExp(`data-section-panel=["']${section}["']`, 'i'),
                    `home page needs a ${section} section panel`,
                );
            }

            const contactIndex = source.indexOf('id="contact"');
            const certificatesIndex = source.indexOf('id="certificates"');
            const casePortfolioIndex = source.indexOf('id="case-portfolio"');
            const caseMinishellIndex = source.indexOf('id="case-minishell"');
            const casePushSwapIndex = source.indexOf('id="case-push-swap"');
            const sectionRailIndex = source.indexOf('class="section-rail"');
            const appearanceCardIndex = source.indexOf('rail-appearance-card');
            const creditCardIndex = source.indexOf('rail-credit-card');
            const infoGridIndex = source.indexOf('class="info-grid"');
            const timeCardIndex = source.indexOf('class="card time-card');
            const connectCardIndex = source.indexOf('class="card connect-card');
            assert.ok(
                casePortfolioIndex < caseMinishellIndex &&
                    caseMinishellIndex < casePushSwapIndex &&
                    casePushSwapIndex < certificatesIndex &&
                    certificatesIndex < contactIndex &&
                    contactIndex < sectionRailIndex &&
                    sectionRailIndex < infoGridIndex,
                'home page order should be main content panels, controls rail, then persistent info cards',
            );
            for (const section of [
                'case-portfolio',
                'case-minishell',
                'case-push-swap',
            ]) {
                assert.match(
                    source,
                    new RegExp(
                        `<section\\b(?=[^>]*id=["']${section}["'])(?=[^>]*class=["'][^"']*\\bcase-panel\\b)(?=[^>]*data-section-panel=["']${section}["'])`,
                        'i',
                    ),
                    `home page needs a same-shell ${section} case-study panel`,
                );
                assert.match(
                    source,
                    new RegExp(
                        `href=["']#${section}["'][^>]*data-panel-link=["']${section}["']`,
                        'i',
                    ),
                    `home page needs a same-shell link for #${section}`,
                );
            }
            assert.equal(
                countOccurrences(
                    source,
                    /href=["']#projects["'][^>]*data-panel-link=["']projects["']/gi,
                ),
                3,
                'each same-shell case study should include a Back to projects link',
            );
            assert.doesNotMatch(
                source,
                /href=["']projects\/(?:portfolio|minishell|push-swap)\.html["'][\s\S]*?>\s*Read /i,
                'home project cards should not visually navigate away for case studies',
            );
            assert.match(
                source,
                /<section\b(?=[^>]*id=["']certificates["'])(?=[^>]*class=["'][^"']*\bcertificates-card\b)(?=[^>]*data-section-panel=["']certificates["'])/i,
                'home page needs a switchable Certificates panel',
            );
            assert.match(
                source,
                /href=["']https:\/\/codeinplace\.stanford\.edu\/cip5\/certificate\/ic8whm["'][\s\S]*?>\s*View certificate\s*<\/a\s*>/i,
                'Certificates panel should link to the Stanford Code in Place certificate proof',
            );
            assert.ok(
                appearanceCardIndex < creditCardIndex &&
                    creditCardIndex < infoGridIndex,
                'home page credits should sit below appearance controls in the rail',
            );
            assert.ok(
                infoGridIndex < timeCardIndex && timeCardIndex < connectCardIndex,
                'home page info grid should place contact links beside the compact time card',
            );
            assert.match(source, /class=["'][^"']*\brail-credit-card\b/i);
            assert.match(source, /&copy; 2026 Aleksandre Davitashvili\./);
            assert.match(
                stripTags(source),
                /Built with HTML\s*,\s*CSS\s*,\s*and JavaScript\s*\./,
            );
            const creditStackTexts = [
                ...source.matchAll(
                    /<span\b(?=[^>]*class=["'][^"']*\bcredit-stack\b)[^>]*>([\s\S]*?)<\/span>/gi,
                ),
            ].map(([, text]) => stripTags(text));
            assert.deepEqual(creditStackTexts, ['HTML', 'CSS', 'JavaScript']);
            assert.doesNotMatch(source, />\s*Back to top\s*</i);

            const nowTag = source.match(
                /<section\b(?=[^>]*id=["']now["'])[^>]*>/i,
            )?.[0];
            const timeTag = source.match(
                /<section\b(?=[^>]*class=["'][^"']*\btime-card\b)[^>]*>/i,
            )?.[0];
            const connectTag = source.match(
                /<section\b(?=[^>]*class=["'][^"']*\bconnect-card\b)[^>]*>/i,
            )?.[0];

            assert.ok(nowTag, 'home page needs a persistent Now card');
            assert.ok(timeTag, 'home page needs a persistent Time card');
            assert.ok(connectTag, 'home page needs a persistent contact-links card');
            assert.doesNotMatch(nowTag, /\bdata-section-panel\b/i);
            assert.doesNotMatch(timeTag, /\bdata-section-panel\b/i);
            assert.doesNotMatch(connectTag, /\bdata-section-panel\b/i);
            assert.match(timeTag, /\baria-label=["']Timezone comparison["']/i);
            assert.doesNotMatch(timeTag, /\baria-labelledby\b/i);
            assert.doesNotMatch(source, /<h2\b[^>]*>\s*Time zones\s*<\/h2>/i);
            assert.doesNotMatch(source, /\bhero-actions\b|\bcall-to-action\b/);
            assert.match(source, /class=["']connect-primary-link["']/i);
        }
    }
});

test('home form labels target real controls', () => {
    const source = pageSources.get('index.html');
    const idSet = getIdSet('index.html');

    for (const tag of getTags(source, 'label')) {
        const controlId = getAttribute(tag, 'for');

        assert.ok(controlId, 'every form label needs a for attribute');
        assert.ok(idSet.has(controlId), `label points to missing #${controlId}`);
    }
});

test('informative images have non-empty alternative text', () => {
    for (const { file } of pages) {
        const source = pageSources.get(file);

        for (const tag of getTags(source, 'img')) {
            const alt = getAttribute(tag, 'alt');

            assert.ok(alt && alt.trim(), `${file} has an image without useful alt text`);
        }
    }
});
