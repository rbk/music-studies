// Tempo: detect from mic (records a short clip -> /api/analyze -> tempo),
// and a "set" mode to push the detected tempo into the shared metronome tempo.

const { useState, useCallback } = React;

function Tempo({ tempo, setTempo, mic, micWarn }) {
    const [detected, setDetected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const detect = useCallback(async () => {
        setErr(null);
        const s = await mic.start();
        if (!s) { setErr("Microphone unavailable"); return; }
        setBusy(true);
        try {
            const blob = await AudioTools.recordForMs(s, 3500);
            const res = await AudioTools.analyzeBlob(blob);
            setDetected(res.tempo);
        } catch (e) {
            setErr(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }, [mic]);

    const useDetected = () => { if (detected) setTempo(detected); };

    return (
        <Card title="Tempo" right={
            <span className={"tag " + (busy ? "live" : "")}>
                <span className={"dot " + (busy ? "on" : "")}></span>
                {busy ? "detecting" : "idle"}
            </span>
        }>
            <div className="big accent">{Math.round(tempo)} <span className="muted" style={{ fontSize: "0.9rem" }}>BPM</span></div>
            <div className="row" style={{ marginTop: "0.6rem", gap: "0.5rem" }}>
                <button onClick={detect} disabled={busy}>{busy ? "Listening…" : "Detect tempo"}</button>
                <button className="primary" onClick={useDetected} disabled={!detected}>Use detected</button>
            </div>
            {detected != null && (
                <div className="muted" style={{ marginTop: "0.4rem" }}>
                    Last detected: <b style={{ color: "var(--text)" }}>{Math.round(detected)} BPM</b>
                </div>
            )}
            {err && <div className="muted bad">{err}</div>}
            {micWarn}
        </Card>
    );
}

window.Tempo = Tempo;