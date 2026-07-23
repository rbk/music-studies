# gh-page

This folder is the GitHub Pages site root for this repo — everything under
here gets published, organized by instrument category (e.g. `drumming/`).
Add new categories as sibling folders and link them from `index.html`.

## Setup

The deploy workflow (`.github/workflows/pages.yml`) builds and publishes this
folder on every push to `main`. It self-enables Pages on the repo the first
time it runs (`configure-pages` with `enablement: true`), so no manual
Settings step is required — just push to `main`, or run the "Deploy GitHub
Pages" workflow from the Actions tab.

After the first successful run, the site is live at
`https://<owner>.github.io/<repo>/` and every subsequent push to `main`
touching `gh-page/**` redeploys automatically.
