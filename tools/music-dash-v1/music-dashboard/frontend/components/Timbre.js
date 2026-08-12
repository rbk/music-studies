// Timbre: detect brightness/texture from a short mic clip.

const { useState, useCallback } = React;

function Timbre({ mic, micWarn }) {
    const [timbre, setTimbre] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const detect = useCallback(async () => {
        setErr(null);
        const s = await mic.start();
        if (!s) { setErr("Microphone unavailable"); return; }
        setBusy(true);
        try {
            const blob = await AudioTools.recordForMs(s, 3000);
            const res = await AudioTools.analyzeBlob(blob);
            setTimbre(res.timbre);
        } catch (e) {
            setErr(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }, [mic]);

    return (
        <Card title="Timbre" right={
            <span className={"tag " + (busy ? "live" : "")}>
                <span className={"dot " + (busy ? "on" : "")}></span>
                {busy ? "detecting" : "idle"}
            </span>
        }>
            {timbre ? (
                <>
                    <div className="big">{timbre.label}</div>
                    <div className="muted" style={{ marginTop: "0.4rem" }}>
                        brightness: <b style={{ color: "var(--text)" }}>{timbre.brightness}</b>
                    </div>
                    <div className="muted">texture: {timbre.texture}</div>
                    <div className="muted">centroid: {timbre.centroid_hz} Hz · rolloff: {timbre.rolloff_hz} Hz</div>
                </>
            ) : (
                <div className="muted">Play a note or chord, then detect.</div>
            )}
            <div className="row" style={{ marginTop: "0.6rem" }}>
                <button onClick={detect} disabled={busy}>{busy ? "Listening…" : "Detect timbre"}</button>
            </div>
            {err && <div className="muted bad">{err}</div>}
            {micWarn}
        </Card>
    );
}

window.Timbre = Timbre;