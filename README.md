# Aleksandre Davitashvili Portfolio

A responsive portfolio built with vanilla HTML, CSS, and JavaScript. The
project documents my frontend learning while presenting selected web and Unix
systems work.

## Features

- Semantic single-page structure
- Responsive bento-style CSS Grid layout
- Accessible section switching
- Separate introduction and GitHub activity cards
- Horizontally scrollable project selection with full case studies and no auto-switching
- Eight expandable certificate panels, including seven coming-soon placeholders
- Interactive line-art avatar that reacts to section previews and selections
- Cursor-following eyes with a reduced-motion fallback
- Persistent light and dark themes
- Direct email CTA with persistent GitHub and LinkedIn profile links
- One-time card reveals using `IntersectionObserver`
- Reduced-motion support
- Visible focus states
- Lazy-loaded project previews
- Social-sharing and search metadata

## Technology

- HTML5
- CSS Grid, Flexbox, custom properties, and media queries
- Vanilla JavaScript
- No framework, runtime dependencies, or build step

## Project Structure

```text
portfolio/
|-- .github/
|   `-- workflows/
|       `-- quality.yml
|-- assets/
|   `-- images/
|-- css/
|   |-- base.css
|   |-- components.css
|   |-- layout.css
|   |-- motion.css
|   |-- reset.css
|   |-- responsive.css
|   |-- sections.css
|   `-- tokens.css
|-- js/
|   |-- main.js
|   `-- theme-init.js
|-- scripts/
|   `-- check.mjs
|-- tests/
|   |-- main-behavior.test.mjs
|   `-- site-contracts.test.mjs
|-- .nojekyll
|-- CONTRIBUTING.md
|-- index.html
|-- LICENSE
|-- package.json
`-- README.md
```

## Run Locally

From the project directory:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

The site has no installation step because it uses browser-native technologies.

## Interactive Avatar

The side rail includes a transparent, stroke-only SVG avatar implemented
directly in the portfolio source. Its pose follows the active portfolio
section:

- About uses the coffee pose.
- Projects and project case studies use the laptop pose.
- Certificates uses the paper-stack pose.

Hovering or focusing a section control previews its pose. Leaving the control
returns the avatar to the active section, while its pupils smoothly follow the
pointer. SVG masks keep body lines from showing through the laptop and papers
without adding background-colored fills. The animation and eye tracking respect
`prefers-reduced-motion`.

On desktop, the rail gives the avatar and Skills and tools cards equal heights.
The avatar sits above
the compact skills card; the same order is preserved in the stacked small-screen
layout.

## Quality Checks

Node is used only for development checks. The website remains ordinary static
HTML, CSS, and JavaScript in the browser, so there is no build step and no
package installation.

Run the automated test suite:

```bash
npm test
```

Run the full local quality check:

```bash
npm run check
```

`npm run check` performs JavaScript syntax checks and then runs the Node test
suite. These tests verify source contracts, internal links, metadata,
accessibility references, and important JavaScript behavior. They do not replace
manual browser, keyboard, screen-reader, reduced-motion, or Lighthouse checks.

For troubleshooting, you can still run the syntax checks directly:

```bash
node --check js/theme-init.js
node --check js/main.js
```

Check the current Git diff for whitespace errors:

```bash
git diff --check
```

Review changed files before committing:

```bash
git status --short
git diff
```

GitHub Actions also runs `npm run check` on pushes and pull requests. The
workflow is quality-only: it does not deploy, publish, require secrets, or write
to the repository.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local
setup, development guidelines, testing expectations, and pull request guidance.

## License

The HTML, CSS, JavaScript, and supporting source code are available under the
[MIT License](LICENSE).

Personal photographs, biography and project copy, and personal branding are
copyright © 2026 Aleksandre Davitashvili and are not licensed for reuse.

## Deployment Status

Deployment is intentionally deferred. The repository is prepared for a future
branch-based GitHub Pages setup, but GitHub Pages should not be enabled until
that decision is made explicitly. Relative asset paths allow the site to work
from the `/portfolio/` project path, and `.nojekyll` prevents an unnecessary
Jekyll build if deployment is approved later.

Before any future deployment, repeat the local quality checks and the manual
mobile, keyboard, link, theme, reduced-motion, and browser checks.

## Profiles

- [GitHub](https://github.com/Adavitas)
- [LinkedIn](https://www.linkedin.com/in/aleksandre-davitashvili-01b339362/)
