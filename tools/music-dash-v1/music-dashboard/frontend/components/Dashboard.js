// Dashboard: composes all components into a responsive grid.
// Shares tempo + mic state across components.

const { useState, useEffect, useCallback } = React;

function Dashboard() {
    const mic = AudioTools.useMic();
    const [tempo, setTempo] = useState(100);
    const [toast, setToast] = useState(null);

    const micWarn = mic.error ? (
        <div className="mic-grant" style={{ marginTop: "0.4rem" }}>
            Mic blocked: {mic.error}. Grant permission in the browser to detect.
        </div>
    ) : null;

    // Auto-dismiss toasts.
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    return (
        <div className="container">
            <div className="header">
                <div>
                    <h1>Music Dashboard</h1>
                    <div className="sub">guitar + timing practice · prototype</div>
                </div>
                <div className="controls">
                    <span className={"tag " + (mic.active ? "live" : "")}>
                        <span className={"dot " + (mic.active ? "on" : "")}></span>
                        mic {mic.active ? "on" : "off"}
                    </span>
                    <button onClick={() => mic.active ? mic.stop() : mic.start()}>
                        {mic.active ? "Stop mic" : "Enable mic"}
                    </button>
                </div>
            </div>

            <div className="grid">
                <Chords mic={mic} micWarn={micWarn} />
                <DrumSessions tempo={tempo} setTempo={setTempo} mic={mic} micWarn={micWarn} />
                <Metronome tempo={tempo} setTempo={setTempo} />
                <Tempo tempo={tempo} setTempo={setTempo} mic={mic} micWarn={micWarn} />
                <Timbre mic={mic} micWarn={micWarn} />
                <KeyDetector mic={mic} micWarn={micWarn} />
                <StyleDetector mic={mic} micWarn={micWarn} />
            </div>

            {toast && <div className={"toast " + (toast.kind || "")}>{toast.msg}</div>}
        </div>
    );
}

window.Dashboard = Dashboard;