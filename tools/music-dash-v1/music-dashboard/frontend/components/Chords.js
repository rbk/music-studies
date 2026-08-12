// Chords: live chord detection from the mic, with a horizontal history
// slider. The current detection is highlighted in the middle and you can
// scroll back through previously detected chords. Each chip shows the
// chord name; the current one also renders a chord diagram.

const { useState, useEffect, useRef, useCallback } = React;

function Chords({ mic, micWarn }) {
    const [history, setHistory] = useState([]);      // [{chord,name,fingering}]
    const [current, setCurrent] = useState(null);   // last detection
    const [live, setLive] = useState(false);
    const [err, setErr] = useState(null);
    const timerRef = useRef(null);
    const stopFlag = useRef(false);
    const scrollRef = useRef(null);

    // Keep the history slider scrolled so the latest is centered.
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = el.scrollWidth;
    }, [history.length]);

    const step = useCallback(async () => {
        if (stopFlag.current) return;
        const s = mic.stream;
        if (!s) { scheduleNext(); return; }
        try {
            const blob = await AudioTools.recordForMs(s, 1500);
            const res = await AudioTools.analyzeBlob(blob);
            if (res.chord && res.chord !== "N") {
                const entry = {
                    chord: res.chord,
                    name: res.chord_name,
                    fingering: res.chord_info ? res.chord_info.fingering : null,
                    t: Date.now(),
                };
                setCurrent(entry);
                setHistory((h) => {
                    // collapse consecutive duplicates
                    if (h.length && h[h.length - 1].chord === entry.chord) return h;
                    const next = [...h, entry];
                    return next.length > 200 ? next.slice(next.length - 200) : next;
                });
            }
        } catch (e) {
            setErr(e.message || String(e));
        } finally {
            scheduleNext();
        }
    }, [mic.stream]);

    const scheduleNext = () => {
        if (stopFlag.current) return;
        timerRef.current = setTimeout(step, 200);
    };

    const start = useCallback(async () => {
        setErr(null);
        const s = await mic.start();
        if (!s) { setErr("Microphone unavailable"); return; }
        stopFlag.current = false;
        setLive(true);
        scheduleNext();
    }, [mic]);

    const stop = useCallback(() => {
        stopFlag.current = true;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setLive(false);
    }, []);

    useEffect(() => () => { stopFlag.current = true;
        if (timerRef.current) clearTimeout(timerRef.current); }, []);

    return (
        <Card title="Chords" wide right={
            <span className={"tag " + (live ? "live" : "")}>
                <span className={"dot " + (live ? "on" : "")}></span>
                {live ? "live" : "stopped"}
            </span>
        }>
            <div className="row" style={{ alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ flex: "0 0 auto" }}>
                    <div className="big accent" style={{ fontSize: "2.8rem" }}>
                        {current ? current.name : "—"}
                    </div>
                    {current && current.fingering && (
                        <ChordDiagram fingering={current.fingering} name={current.name} />
                    )}
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div className="muted" style={{ marginBottom: "0.3rem" }}>
                        History (scroll back) — latest on the right:
                    </div>
                    <div className="history" ref={scrollRef}>
                        {history.length === 0 && <span className="chip muted">no detections yet</span>}
                        {history.map((h, i) => (
                            <span key={i} className={"chip " + (i === history.length - 1 ? "current" : "")}>
                                {h.name}
                            </span>
                        ))}
                    </div>
                    <div className="row" style={{ marginTop: "0.6rem", gap: "0.5rem" }}>
                        <button className={live ? "danger" : "primary"} onClick={live ? stop : start}>
                            {live ? "Stop" : "Start live detect"}
                        </button>
                        <button onClick={() => { setHistory([]); setCurrent(null); }}>Clear</button>
                        <span className="muted">{history.length} detected</span>
                    </div>
                    {err && <div className="muted bad">{err}</div>}
                    {micWarn}
                </div>
            </div>
        </Card>
    );
}

window.Chords = Chords;