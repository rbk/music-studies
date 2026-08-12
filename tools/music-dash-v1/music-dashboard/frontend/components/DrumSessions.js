// DrumSessions: practice timing against a metronome.
// - set tempo (shared with dashboard)
// - enable metronome
// - detect drum hits from the mic via an energy-onset detector
// - compare each hit to the nearest scheduled beat -> accuracy %
// - start/end session, persist to /api/sessions, list previous sessions

const { useState, useEffect, useRef, useCallback } = React;

// Onset-detection + beat-matching session engine.
function createSessionEngine() {
    let ctx = null;
    let analyser = null;
    let source = null;
    let rafId = null;
    let tempo = 100;
    let running = false;
    let startTime = 0;       // ctx time the session began
    let nextBeatTime = 0;    // ctx time of next scheduled beat
    let beatIndex = 0;
    let beats = [];          // [{index, time, matched, offset, hitTime}]
    let hits = [];           // [{time}]
    let lastHitTime = 0;
    let rmsHistory = [];     // running RMS for adaptive threshold
    let metronomeOn = true;
    const WINDOW = 0.16;     // ±seconds to count a hit as matching a beat
    const SMALL = 0.03;      // ±seconds considered "on time"
    let onStats = null;

    function ensureCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function click(at) {
        if (!metronomeOn) return;
        const c = ctx;
        const osc = c.createOscillator();
        const gain = c.createGain();
        const isDown = beatIndex % 4 === 0;
        osc.frequency.value = isDown ? 1400 : 880;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(isDown ? 0.45 : 0.28, at + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        osc.connect(gain).connect(c.destination);
        osc.start(at);
        osc.stop(at + 0.06);
    }

    function scheduleBeats() {
        const beatDur = 60.0 / tempo;
        while (nextBeatTime < ctx.currentTime + 0.15) {
            click(nextBeatTime);
            beats.push({ index: beatIndex, time: nextBeatTime,
                         matched: false, offset: null, hitTime: null });
            beatIndex++;
            nextBeatTime += beatDur;
        }
    }

    function detectLoop() {
        if (!running) return;
        scheduleBeats();
        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);

        rmsHistory.push(rms);
        if (rmsHistory.length > 50) rmsHistory.shift();
        const avg = rmsHistory.reduce((a, b) => a + b, 0) / rmsHistory.length;
        const threshold = Math.max(0.04, avg * 3.2);

        const now = ctx.currentTime;
        if (rms > threshold && now - lastHitTime > 0.08) {
            lastHitTime = now;
            hits.push({ time: now });
            // match to nearest unmatched beat within window
            let best = null;
            let bestDist = Infinity;
            for (const b of beats) {
                if (b.matched) continue;
                const d = Math.abs(now - b.time);
                if (d < bestDist) { bestDist = d; best = b; }
            }
            if (best && bestDist <= WINDOW) {
                best.matched = true;
                best.offset = now - best.time; // -early .. +late
                best.hitTime = now;
            }
            emitStats();
        }
        rafId = requestAnimationFrame(detectLoop);
    }

    function emitStats() {
        if (!onStats) return;
        const total = beats.length;
        const matched = beats.filter((b) => b.matched).length;
        let early = 0, late = 0, onTime = 0;
        for (const b of beats) {
            if (!b.matched) continue;
            if (b.offset < -SMALL) early++;
            else if (b.offset > SMALL) late++;
            else onTime++;
        }
        const missed = total - matched;
        const accuracy = total ? Math.round((matched / total) * 100) : 0;
        onStats({
            total_beats: total, hits: matched, on_time: onTime,
            early, late, missed, accuracy,
        });
    }

    async function start(stream, bpm, withMetronome) {
        tempo = Math.max(20, Math.min(300, bpm));
        metronomeOn = withMetronome;
        const c = ensureCtx();
        if (c.state === "suspended") await c.resume();
        source = c.createMediaStreamSource(stream);
        analyser = c.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        // analyser does NOT connect to destination (no feedback)
        beats = []; hits = []; rmsHistory = [];
        beatIndex = 0;
        running = true;
        startTime = c.currentTime + 0.15;
        nextBeatTime = startTime;
        detectLoop();
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        // finalize missed for any beats that never got a hit
        const total = beats.length;
        const matched = beats.filter((b) => b.matched).length;
        let early = 0, late = 0, onTime = 0;
        for (const b of beats) {
            if (!b.matched) continue;
            if (b.offset < -SMALL) early++;
            else if (b.offset > SMALL) late++;
            else onTime++;
        }
        const missed = total - matched;
        const accuracy = total ? Math.round((matched / total) * 100) : 0;
        const result = {
            total_beats: total, hits: matched, on_time: onTime,
            early, late, missed, accuracy,
            duration_s: ctx ? (ctx.currentTime - startTime) : 0,
        };
        try { source && source.disconnect(); } catch (_) {}
        return result;
    }

    function setTempo(bpm) { tempo = Math.max(20, Math.min(300, bpm)); }
    function setMetronome(on) { metronomeOn = on; }
    function onStatsFn(fn) { onStats = fn; }

    return { start, stop, setTempo, setMetronome, onStats: onStatsFn };
}

function DrumSessions({ tempo, setTempo, mic, micWarn }) {
    const [useMet, setUseMet] = useState(true);
    const [running, setRunning] = useState(false);
    const [stats, setStats] = useState(null);
    const [finalResult, setFinalResult] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [err, setErr] = useState(null);
    const engineRef = useRef(null);
    const tempoRef = useRef(tempo);
    tempoRef.current = tempo;

    const refresh = useCallback(async () => {
        try { setSessions(await AudioTools.apiGet("/api/sessions")); }
        catch (e) { setErr(e.message || String(e)); }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const start = useCallback(async () => {
        setErr(null);
        setFinalResult(null);
        setStats(null);
        const s = await mic.start();
        if (!s) { setErr("Microphone unavailable"); return; }
        engineRef.current = createSessionEngine();
        engineRef.current.onStats(setStats);
        engineRef.current.setMetronome(useMet);
        await engineRef.current.start(s, tempoRef.current, useMet);
        setRunning(true);
    }, [mic, useMet]);

    const stop = useCallback(async () => {
        const e = engineRef.current;
        if (!e) return;
        const res = e.stop();
        setRunning(false);
        setFinalResult(res);
        engineRef.current = null;
        // persist
        try {
            await AudioTools.apiPostJson("/api/sessions", {
                tempo: tempoRef.current,
                duration_s: Math.max(0, res.duration_s),
                accuracy: res.accuracy,
                total_beats: res.total_beats,
                hits: res.hits,
                early: res.early,
                late: res.late,
                missed: res.missed,
                hit_offsets: [],
            });
            refresh();
        } catch (ex) {
            setErr("saved locally, post failed: " + (ex.message || ex));
        }
    }, [refresh]);

    const del = useCallback(async (id) => {
        try { await AudioTools.apiDelete("/api/sessions/" + id); refresh(); }
        catch (e) { setErr(e.message || String(e)); }
    }, [refresh]);

    const live = stats || {};
    const fr = finalResult || {};

    return (
        <Card title="Drum Sessions" wide right={
            <span className={"tag " + (running ? "live" : "")}>
                <span className={"dot " + (running ? "on" : "")}></span>
                {running ? "session running" : "idle"}
            </span>
        }>
            <div className="row" style={{ gap: "0.75rem", marginBottom: "0.6rem" }}>
                <label className="muted">Tempo</label>
                <input type="number" value={tempo} min="20" max="300"
                       onChange={(e) => setTempo(Math.max(20, Math.min(300, Number(e.target.value) || 100)))}/>
                <span className="muted">BPM</span>
                <label className="muted" style={{ marginLeft: "0.5rem" }}>
                    <input type="checkbox" checked={useMet}
                           onChange={(e) => { setUseMet(e.target.checked);
                               engineRef.current && engineRef.current.setMetronome(e.target.checked); }}/>
                    {" "}metronome
                </label>
                <div className="spacer"></div>
                <button className={running ? "danger" : "primary"} onClick={running ? stop : start}>
                    {running ? "End session" : "Start session"}
                </button>
            </div>

            <div className="row" style={{ gap: "1.2rem" }}>
                <Stat label="Accuracy" value={fmtPct(running ? live.accuracy : fr.accuracy)}
                      tone={accTone(running ? live.accuracy : fr.accuracy)} big/>
                <Stat label="Beats" value={(running ? live.total_beats : fr.total_beats) || 0}/>
                <Stat label="Hits" value={(running ? live.hits : fr.hits) || 0}/>
                <Stat label="On time" value={(running ? live.on_time : fr.on_time) || 0} tone="good"/>
                <Stat label="Early" value={(running ? live.early : fr.early) || 0} tone="bad"/>
                <Stat label="Late" value={(running ? live.late : fr.late) || 0} tone="bad"/>
                <Stat label="Missed" value={(running ? live.missed : fr.missed) || 0} tone="bad"/>
            </div>

            <div className="muted" style={{ marginTop: "0.5rem" }}>
                {running
                    ? "Tap your drum hits. Hits within ±160ms of a beat count as matched."
                    : (fr.accuracy != null
                        ? `Last session: ${fr.accuracy}% accuracy over ${fr.total_beats} beats (${fr.duration_s?.toFixed(1)}s).`
                        : "Start a session, then play along to the metronome.")}
            </div>
            {err && <div className="muted bad" style={{ marginTop: "0.4rem" }}>{err}</div>}
            {micWarn}

            <h3 style={{ margin: "1rem 0 0.3rem", fontSize: "0.72rem",
                         textTransform: "uppercase", letterSpacing: "0.1em",
                         color: "var(--muted)" }}>Previous sessions</h3>
            {sessions.length === 0 ? (
                <div className="muted">No sessions yet.</div>
            ) : (
                <table className="sessions">
                    <thead>
                        <tr>
                            <th>When</th><th>Tempo</th><th>Acc</th><th>Beats</th>
                            <th>Hits</th><th>Early</th><th>Late</th><th>Missed</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((s) => (
                            <tr key={s.id}>
                                <td>{moment.unix(s.created_at).fromNow()}</td>
                                <td>{Math.round(s.tempo)}</td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <div className="acc-bar" style={{ width: "60px" }}>
                                            <div style={{ width: s.accuracy + "%",
                                                background: s.accuracy >= 70 ? "var(--good)" : "var(--bad)" }}></div>
                                        </div>
                                        <span>{s.accuracy}%</span>
                                    </div>
                                </td>
                                <td>{s.total_beats}</td>
                                <td>{s.hits}</td>
                                <td>{s.early}</td>
                                <td>{s.late}</td>
                                <td>{s.missed}</td>
                                <td><button className="danger" onClick={() => del(s.id)}>✕</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Card>
    );
}

function fmtPct(v) { return v == null ? "—" : v + "%"; }
function accTone(v) { return v == null ? "" : (v >= 70 ? "good" : "bad"); }

function Stat({ label, value, tone, big }) {
    return (
        <div style={{ minWidth: 60 }}>
            <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase",
                                             letterSpacing: "0.06em" }}>{label}</div>
            <div className={(tone === "good" ? "good" : tone === "bad" ? "bad" : "") +
                            (big ? " big" : "")}
                 style={{ fontSize: big ? "1.6rem" : "1.15rem", fontWeight: 700 }}>{value}</div>
        </div>
    );
}

window.DrumSessions = DrumSessions;