# Drumming Practice Guides

Printable, one/two-page HTML quick-reference guides for electronic drum
modules and similar gear. Each guide is a data-driven page: content lives in
a JSON file, layout/CSS lives in one shared template, and a small stdlib-only
Python script renders the two into a self-contained static HTML file.

```
drumming/
  index.html              landing page listing all guides
  build_guide.py           renders content.json -> guides/<slug>.html
  template/
    guide_template.html    shared HTML shell, CSS, print rules
  data/
    <guide-slug>/
      content.json          the guide's text content
      *.svg                 any inline diagrams the guide references
  guides/
    <guide-slug>.html        generated output (what you open/print/publish)
```

## Viewing a guide

Open any file under `guides/` directly in a browser, or print it
(`Cmd/Ctrl+P`) — each guide is styled for US Letter with 0.6in/0.7in margins
and sections that won't split across a printed page.

## Adding a new guide

1. Create `data/<new-slug>/content.json` (copy
   `data/nitro-drum-module/content.json` as a starting point) and add any
   diagram `.svg` files it references, in the same folder.
2. Run:
   ```
   python3 build_guide.py data/<new-slug>/content.json
   ```
   This writes `guides/<new-slug>.html`.
3. Add a link to it in `index.html`.

No dependencies beyond Python 3's standard library — nothing to `pip
install`.

### content.json schema

```jsonc
{
  "page_title": "<title> tag text",
  "title": "Big heading in the page header",
  "subtitle": "Small heading under the title",
  "footer": "Footer text",
  "sections": [
    {
      "heading": "1. Section Name",
      "intro": "Optional paragraph shown above the table.",
      "diagram": "some-diagram.svg",     // optional, resolved relative to this JSON file
      "diagram_class": "pad-diagram",     // optional, use for a squarer diagram so it doesn't print oversized
      "rows": [
        { "ctrl": "BUTTON NAME", "desc": "What it does." }
      ],
      "tip": "Optional italic tip line, 'Tip: ' is prepended automatically."
    },
    {
      "heading": "Suggested Routine",
      "routine": [
        { "bold": "Step name", "text": "rest of the sentence." }
      ]
    }
  ]
}
```

A section renders, in order: intro paragraph, diagram, table, tip. A
`routine` section renders as a highlighted numbered-list box instead (used
for a closing "suggested practice routine" section).

## Publishing to GitHub Pages

This folder lives under `gh-page/drumming/`, which is the GitHub Pages site
root for this repo (see `.github/workflows/pages.yml`, and `gh-page/README.md`
for the one-time Settings step). It's linked from `gh-page/index.html` and
deploys automatically on every push to `main` that touches `gh-page/**`. No
build step runs at publish time — commit the generated files under
`guides/`, the workflow just uploads the folder as-is.
