// StyleDetector: heuristic music-style guess from a mic clip.

const { useState, useCallback } = React;

function StyleDetector({ mic, micWarn }) {
    const [style, setStyle] = useState(null);
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
            setStyle(res.style);
        } catch (e) {
            setErr(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }, [mic]);

    return (
        <Card title="Music Style" right={
            <span className={"tag " + (busy ? "live" : "")}>
                <span className={"dot " + (busy ? "on" : "")}></span>
                {busy ? "detecting" : "idle"}
            </span>
        }>
            {style ? (
                <>
                    <div className="big accent" style={{ textTransform: "capitalize" }}>{style.style}</div>
                    <div className="muted" style={{ marginTop: "0.4rem" }}>
                        confidence: <b style={{ color: "var(--text)" }}>{style.confidence}</b>
                        {style.runner_up ? <> · maybe: {style.runner_up}</> : null}
                    </div>
                    <div className="muted">tempo ≈ {Math.round(style.tempo)} BPM · onsets/s ≈ {style.onset_density}</div>
                </>
            ) : (
                <div className="muted">Play something for ~6s, then detect.</div>
            )}
            <div className="row" style={{ marginTop: "0.6rem" }}>
                <button onClick={detect} disabled={busy}>{busy ? "Listening…" : "Detect style"}</button>
            </div>
            {err && <div className="muted bad">{err}</div>}
            {micWarn}
        </Card>
    );
}

window.StyleDetector = StyleDetector;