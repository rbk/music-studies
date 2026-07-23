#!/usr/bin/env python3
"""Render a drumming practice-guide HTML page from a JSON content file.

Usage:
    python3 build_guide.py data/<guide-slug>/content.json

Reads data/<slug>/content.json (plus any SVG diagram files referenced from
it, resolved relative to that same folder) and renders it through
template/guide_template.html, writing the result to guides/<slug>.html.

Stdlib only — no external dependencies, so it runs anywhere Python 3 does.
"""
import html
import json
import pathlib
import sys


def render_section(section, data_dir):
    heading = html.escape(section["heading"])
    parts = [f"  <section>\n    <h2>{heading}</h2>"]

    if "intro" in section:
        parts.append(f'    <p class="intro">{html.escape(section["intro"])}</p>')

    if "diagram" in section:
        svg_content = (data_dir / section["diagram"]).read_text(encoding="utf-8").strip()
        css_class = section.get("diagram_class", "")
        class_attr = f" {css_class}" if css_class else ""
        parts.append(f'    <div class="diagram-wrap{class_attr}">\n      {svg_content}\n    </div>')

    if "rows" in section:
        rows = ['    <table class="ref">']
        for row in section["rows"]:
            ctrl = html.escape(row["ctrl"])
            desc = html.escape(row["desc"])
            rows.append(f'      <tr><td class="ctrl">{ctrl}</td><td class="desc">{desc}</td></tr>')
        rows.append("    </table>")
        parts.append("\n".join(rows))

    if "tip" in section:
        parts.append(f'    <p class="tip">Tip: {html.escape(section["tip"])}</p>')

    if "routine" in section:
        box = ['    <div class="routine-box">', "      <ol>"]
        for item in section["routine"]:
            bold = html.escape(item["bold"])
            text = html.escape(item["text"])
            box.append(f"        <li><b>{bold}</b> — {text}</li>")
        box.append("      </ol>")
        box.append("    </div>")
        parts.append("\n".join(box))

    parts.append("  </section>\n")
    return "\n".join(parts)


def main():
    if len(sys.argv) != 2:
        print("usage: build_guide.py <path/to/content.json>", file=sys.stderr)
        sys.exit(1)

    content_path = pathlib.Path(sys.argv[1]).resolve()
    data_dir = content_path.parent
    data = json.loads(content_path.read_text(encoding="utf-8"))

    script_dir = pathlib.Path(__file__).parent.resolve()
    template = (script_dir / "template" / "guide_template.html").read_text(encoding="utf-8")

    sections_html = "\n".join(render_section(s, data_dir) for s in data["sections"])

    output = (
        template
        .replace("{{PAGE_TITLE}}", html.escape(data.get("page_title", data["title"])))
        .replace("{{TITLE}}", html.escape(data["title"]))
        .replace("{{SUBTITLE}}", html.escape(data["subtitle"]))
        .replace("{{FOOTER}}", html.escape(data["footer"]))
        .replace("{{SECTIONS}}", sections_html)
    )

    slug = data_dir.name
    out_dir = script_dir / "guides"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / f"{slug}.html"
    out_path.write_text(output, encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
