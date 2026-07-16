# Contributing

Thank you for taking the time to improve this portfolio. Contributions that
fix bugs, improve accessibility, strengthen tests, or make the code easier to
understand are welcome.

## Before You Start

- Check the existing issues and pull requests to avoid duplicating work.
- Open or comment on an issue before starting a substantial change so the
  approach can be discussed.
- Keep each pull request focused on one problem. Submit unrelated improvements
  separately.

## Local Setup

You will need Git, Python 3, a modern browser, and the current Node.js LTS
release with npm. The website has no runtime dependencies, installation step,
build step, or framework.

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/portfolio.git
   cd portfolio
   ```

2. Create a branch for your change:

   ```bash
   git switch -c fix/short-description
   ```

3. Start a local static server:

   ```bash
   python3 -m http.server 8000
   ```

4. Open `http://localhost:8000/` in a browser.

## Development Guidelines

- Use semantic HTML and preserve keyboard and screen-reader accessibility.
- Follow the existing CSS organization and reuse design tokens and custom
  properties where possible.
- Keep JavaScript framework-free and progressively enhanced. Core content must
  remain usable if JavaScript is unavailable.
- Preserve responsive behavior, visible focus states, reduced-motion support,
  and light and dark themes.
- Avoid adding dependencies or a build step without discussing the change in
  an issue first.
- Match the style and formatting of the surrounding code.

## Tests and Manual Checks

Run the complete automated check before submitting a pull request:

```bash
npm run check
```

Also check the diff for whitespace errors:

```bash
git diff --check
```

Bug fixes should include a regression test that fails before the fix and passes
after it. Prefer testing observable behavior instead of requiring a particular
implementation.

Automated checks do not replace browser testing. Depending on the change,
verify:

- desktop and mobile layouts;
- keyboard navigation and visible focus;
- light and dark themes and each accent color;
- reduced-motion behavior;
- fine- and coarse-pointer behavior; and
- any affected form, link, scrolling, or history interactions.

For visual changes, test the relevant states and include before-and-after
screenshots or a short recording in the pull request.

## Commits and Pull Requests

- Write clear commit messages that describe the change.
- Update documentation when behavior or setup changes.
- Do not include unrelated formatting, generated files, or personal editor
  files.
- In the pull request, explain the problem, the chosen solution, and how you
  tested it.
- Link the related issue and note any known limitations or follow-up work.
- Push follow-up commits to the same branch when responding to review feedback;
  a new pull request is usually unnecessary.

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
