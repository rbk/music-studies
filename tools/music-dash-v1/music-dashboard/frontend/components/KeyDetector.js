// KeyDetector: detect the musical key from a longer mic clip.

const { useState, useCallback } = React;

function KeyDetector({ mic, micWarn }) {
    const [key, setKey] = useState(null);
    const [detail, setDetail] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const detect = useCallback(async () => {
        setErr(null);
        const s = await mic.start();
        if (!s) { setErr("Microphone unavailable"); return; }
        setBusy(true);
        try {
            const blob = await AudioTools.recordForMs(s, 6000);
            const res = await AudioTools.analyzeBlob(blob);
            setKey(res.key || "unknown");
            setDetail({
                chords: (res.chord_history || []).map((c) => c.name),
                tempo: res.tempo,
            });
        } catch (e) {
            setErr(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }, [mic]);

    return (
        <Card title="Key Detector" right={
            <span className={"tag " + (busy ? "live" : "")}>
                <span className={"dot " + (busy ? "on" : "")}></span>
                {busy ? "detecting" : "idle"}
            </span>
        }>
            <div className="big accent">{key || "—"}</div>
            {detail && (
                <div className="muted" style={{ marginTop: "0.4rem" }}>
                    from {detail.chords.length} chord{detail.chords.length === 1 ? "" : "s"}:
                    {" "}{detail.chords.slice(0, 8).join(", ")}
                    {detail.chords.length > 8 ? "…" : ""}
                    <br/>tempo ≈ {Math.round(detail.tempo)} BPM
                </div>
            )}
            <div className="muted" style={{ marginTop: "0.3rem" }}>
                Play a progression for ~6s, then detect.
            </div>
            <div className="row" style={{ marginTop: "0.6rem" }}>
                <button onClick={detect} disabled={busy}>{busy ? "Listening…" : "Detect key"}</button>
            </div>
            {err && <div className="muted bad">{err}</div>}
            {micWarn}
        </Card>
    );
}

window.KeyDetector = KeyDetector;