// Metronome: set tempo, play/pause, with a visual beat pulse.
// Uses the shared Web Audio metronome engine from AudioTools.

const { useState, useEffect, useRef, useCallback } = React;

function Metronome({ tempo, setTempo }) {
    const engineRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [beatFlash, setBeatFlash] = useState(-1);

    useEffect(() => {
        engineRef.current = AudioTools.createMetronomeEngine();
        const off = engineRef.current.onBeat((bi) => {
            setBeatFlash(bi % 4);
            setTimeout(() => setBeatFlash(-1), 90);
        });
        return () => { engineRef.current.stop(); off(); };
    }, []);

    const toggle = useCallback(() => {
        const e = engineRef.current;
        e.setTempo(tempo);
        if (e.isRunning()) { e.stop(); setPlaying(false); }
        else { e.start(); setPlaying(true); }
    }, [tempo]);

    const onTempo = (v) => {
        const n = Math.max(20, Math.min(300, Number(v) || 100));
        setTempo(n);
        if (engineRef.current) engineRef.current.setTempo(n);
    };

    return (
        <Card title="Metronome" right={
            <span className={"tag " + (playing ? "live" : "")}>
                <span className={"dot " + (playing ? "on" : "")}></span>
                {playing ? "playing" : "stopped"}
            </span>
        }>
            <div className="row" style={{ gap: "0.75rem" }}>
                <div className="pulse" style={{
                    background: beatFlash === 0 ? "#9fff00" :
                                beatFlash >= 0 ? "#44bce7" : "#2a3038",
                }}></div>
                <input type="number" value={tempo} min="20" max="300"
                       onChange={(e) => onTempo(e.target.value)}/>
                <span className="muted">BPM</span>
                <div className="spacer"></div>
                <button className={playing ? "danger" : "primary"} onClick={toggle}>
                    {playing ? "Pause" : "Play"}
                </button>
            </div>
            <input type="range" min="40" max="220" value={tempo}
                   onChange={(e) => onTempo(e.target.value)}
                   style={{ width: "100%", marginTop: "0.6rem" }}/>
            <div className="muted" style={{ marginTop: "0.4rem" }}>
                Beat {beatFlash >= 0 ? (beatFlash + 1) : "-"} / 4
            </div>
        </Card>
    );
}

window.Metronome = Metronome;