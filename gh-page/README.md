# gh-page

This folder is the GitHub Pages site root for this repo — everything under
here gets published, organized by instrument category (e.g. `drumming/`).
Add new categories as sibling folders and link them from `index.html`.

## One-time setup (repo admin, do this once)

The deploy workflow (`.github/workflows/pages.yml`) is already wired up to
build and publish this folder on every push to `main`, but GitHub Pages
itself still needs to be pointed at it:

1. Go to **Settings → Pages** in the repo.
2. Under **Build and deployment → Source**, choose **GitHub Actions**
   (not "Deploy from a branch" — this folder isn't `/docs` or repo root, so
   the branch-deploy option can't serve it directly).
3. Push to `main` (or re-run the "Deploy GitHub Pages" workflow from the
   Actions tab) to trigger the first deployment.

After that, the site is live at `https://<owner>.github.io/<repo>/` and every
subsequent push to `main` touching `gh-page/**` redeploys automatically.
