# Aleksandre Davitashvili Portfolio

A responsive portfolio built with vanilla HTML, CSS, and JavaScript. The
project documents my frontend learning while presenting selected web and Unix
systems work.

## Features

- Semantic single-page structure
- Responsive bento-style CSS Grid layout
- Accessible mobile navigation
- Persistent light and dark themes
- Contact-form validation that prepares an email draft
- One-time card reveals using `IntersectionObserver`
- Reduced-motion support
- Keyboard skip link and visible focus states
- Lazy-loaded project previews
- Social-sharing and search metadata

## Technology

- HTML5
- CSS Grid, Flexbox, custom properties, and media queries
- Vanilla JavaScript
- No framework, package manager, or build step

## Project Structure

```text
portfolio/
|-- .github/
|   `-- workflows/
|       `-- quality.yml
|-- assets/
|   `-- images/
|-- css/
|   |-- reset.css
|   `-- style.css
|-- js/
|   |-- main.js
|   `-- theme-init.js
|-- projects/
|   |-- minishell.html
|   |-- portfolio.html
|   `-- push-swap.html
|-- scripts/
|   `-- check.mjs
|-- tests/
|   |-- main-behavior.test.mjs
|   `-- site-contracts.test.mjs
|-- .nojekyll
|-- index.html
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

## Deployment Status

Deployment is intentionally deferred. The repository is prepared for a future
branch-based GitHub Pages setup, but GitHub Pages should not be enabled until
that decision is made explicitly. Relative asset paths allow the site to work
from the `/portfolio/` project path, and `.nojekyll` prevents an unnecessary
Jekyll build if deployment is approved later.

Before any future deployment, repeat the local quality checks and the manual
mobile, keyboard, link, theme, form, reduced-motion, and browser checks.

## Contact

- [GitHub](https://github.com/Adavitas)
- [LinkedIn](https://www.linkedin.com/in/aleksandre-davitashvili-01b339362/)
- [Email](mailto:leqso.davitashvili.st@gmail.com)
