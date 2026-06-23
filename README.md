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
|-- assets/
|   `-- images/
|-- css/
|   |-- reset.css
|   `-- style.css
|-- js/
|   |-- main.js
|   `-- theme-init.js
|-- .nojekyll
|-- index.html
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

Check both JavaScript files:

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

## GitHub Pages Deployment

This repository is prepared for branch-based GitHub Pages deployment. Relative
asset paths allow it to work from the `/portfolio/` project path, and
`.nojekyll` prevents an unnecessary Jekyll build.

1. Push the `main` branch to GitHub.
2. Open the repository's **Settings**.
3. Select **Pages** under **Code and automation**.
4. Choose **Deploy from a branch**.
5. Select the `main` branch and the `/ (root)` folder.
6. Save the configuration.
7. Open the published URL shown by GitHub and repeat the mobile, keyboard, link,
   theme, form, and reduced-motion checks.

## Contact

- [GitHub](https://github.com/Adavitas)
- [LinkedIn](https://www.linkedin.com/in/aleksandre-davitashvili-01b339362/)
- [Email](mailto:leqso.davitashvili.st@gmail.com)
