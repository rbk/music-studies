# 06 — Storage and History

## Storage (`storage/sessions.ts`)

`localStorage`, chosen deliberately over IndexedDB: sessions are a few KB each
(a 10-minute 1/16-note session at 120 BPM is ~4,800 hits ≈ 300 KB worst case,
typical sessions far less), synchronous access is fine at this scale, and the
code stays trivially readable. localStorage's ~5 MB budget holds months of
practice; the export path (below) is the pressure valve if it ever fills.

### Layout

```
dt:v1:index          → ["<id1>", "<id2>", ...]          // newest first
dt:v1:session:<id>   → Session (JSON)
dt:v1:settings       → { lastSessionSettings, detectorSettings, calibrationMs }
```

- One key per session (not one giant array) so saving a session never rewrites
  history, and a single corrupt entry can't take down the rest.
- Every key carries a schema version (`v1`). A tiny `migrate()` runs at startup;
  unknown-version keys are left untouched. This is cheap now and priceless later.

### API

```ts
listSessions(): SessionMeta[]        // id, date, label, stats — no hit arrays
loadSession(id): Session | null
saveSession(s: Session): void
deleteSession(id): void
exportAll(): Blob                    // one JSON file, schema-versioned
importAll(file: File): ImportResult  // merge by id; never silently overwrites
loadSettings() / saveSettings()
```

`listSessions` returns metadata only (stats are denormalized onto the session
for exactly this reason) so the history screen never parses hit arrays.

### Export / import

- **Export:** single JSON file `drum-trainer-export-YYYY-MM-DD.json` containing
  schema version + all sessions + settings. This is the backup story and the
  escape hatch from browser storage (cleared site data, switching machines).
- **Import:** merges by session id; on conflict keeps the existing session and
  reports it. Validates schema version and shape before touching storage.

Quota errors (`QuotaExceededError`) surface as a visible warning with a pointer
to export + delete old sessions — never a silent save failure.

## History charts (`ui/components/HistoryChart.tsx`)

### Library: uPlot

Chosen over alternatives:

- **uPlot** (~50 KB, zero deps): time-series line/scatter, fast, tiny. Fits the
  "few, boring dependencies" rule. Its API is low-level but we need exactly two
  chart shapes.
- MUI X Charts — rejected: heavier, and pulls chart concerns into the component
  library choice.
- Recharts/Chart.js — rejected: larger, no capability we need that uPlot lacks.
- Hand-rolled SVG — rejected: tooltips/axes/zoom cost more code than uPlot weighs.

Wrapped once in `HistoryChart.tsx` so uPlot's imperative API touches exactly one
file (and swapping libraries later is one-file surgery).

### The two charts

1. **Improvement trend (History screen).** X = session date, Y = `stdDevMs`
   (tightness) as the primary line; `meanOffsetMs` as a secondary series around a
   zero line. Filterable by label and BPM (e.g. show only "paradiddles @ 100"),
   since mixing exercises in one trend hides improvement. Sessions flagged
   `tooFewHits` are dimmed.
2. **Session detail (Summary screen).** Scatter of `offsetMs` vs. beat index for
   the just-finished session, zero line + accuracy-window band. Shows *where* in
   the session timing drifted (e.g. tightening up after 2 minutes). The offset
   histogram from `SessionStats` renders beside it as a simple bar chart.

The **live meter is not a chart** — it's a plain styled div driven by the latest
offset (see 07); uPlot is never in the real-time path.
