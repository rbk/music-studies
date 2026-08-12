// Shared audio helpers for the music dashboard.
// Exposes window.AudioTools: API base, mic capture, MediaRecorder helpers,
// and a fetch helper that POSTs an audio blob to /api/analyze.

const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = (() => {
    // Same-origin: the Flask app serves the frontend itself.
    return window.location.origin;
})();

async function apiGet(path) {
    const res = await axios.get(API_BASE + path);
    return res.data;
}

async function apiPostJson(path, body) {
    const res = await axios.post(API_BASE + path, body, {
        headers: { "Content-Type": "application/json" },
    });
    return res.data;
}

async function apiDelete(path) {
    const res = await axios.delete(API_BASE + path);
    return res.data;
}

async function analyzeBlob(blob) {
    const form = new FormData();
    const ext = (blob.type && blob.type.includes("webm")) ? "webm"
              : (blob.type && blob.type.includes("ogg")) ? "ogg" : "webm";
    form.append("audio", blob, `clip.${ext}`);
    const res = await axios.post(API_BASE + "/api/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 20000,
    });
    return res.data;
}

// ---- Mic capture -----------------------------------------------------

function useMic() {
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [active, setActive] = useState(false);
    const streamRef = useRef(null);

    const start = useCallback(async () => {
        if (streamRef.current) return streamRef.current;
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
            streamRef.current = s;
            setStream(s);
            setActive(true);
            setError(null);
            return s;
        } catch (e) {
            setError(e.message || String(e));
            setActive(false);
            return null;
        }
    }, []);

    const stop = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setStream(null);
        setActive(false);
    }, []);

    useEffect(() => () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
    }, []);

    return { stream, active, error, start, stop };
}

// Pick a MediaRecorder mime type the browser actually supports.
function pickRecorderMime() {
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
    ];
    if (typeof MediaRecorder === "undefined") return null;
    for (const c of candidates) {
        if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
}

// Record `ms` milliseconds of audio from a MediaStream and resolve a Blob.
function recordForMs(stream, ms) {
    return new Promise((resolve, reject) => {
        const mime = pickRecorderMime();
        let rec;
        try {
            rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        } catch (e) {
            reject(e);
            return;
        }
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => resolve(new Blob(chunks, { type: mime || "audio/webm" }));
        rec.onerror = (e) => reject(e);
        rec.start();
        setTimeout(() => { try { rec.stop(); } catch (_) {} }, ms);
    });
}

// ---- Web Audio metronome engine --------------------------------------

function createMetronomeEngine() {
    let ctx = null;
    let nextTickTime = 0;
    let beatIndex = 0;
    let schedulerId = null;
    let tempo = 100;
    let running = false;
    const beatListeners = new Set();

    function ensureCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function setTempo(bpm) { tempo = Math.max(20, Math.min(300, bpm)); }

    function click(at) {
        const c = ensureCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        const isDown = beatIndex % 4 === 0;
        osc.frequency.value = isDown ? 1500 : 900;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(isDown ? 0.5 : 0.3, at + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        osc.connect(gain).connect(c.destination);
        osc.start(at);
        osc.stop(at + 0.06);
    }

    function schedule() {
        const c = ensureCtx();
        const beatDur = 60.0 / tempo;
        while (nextTickTime < c.currentTime + 0.12) {
            click(nextTickTime);
            const bi = beatIndex;
            const when = nextTickTime;
            // notify listeners slightly ahead so UI pulse can animate
            const delay = Math.max(0, (when - c.currentTime) * 1000);
            setTimeout(() => beatListeners.forEach((fn) => fn(bi, when)), delay);
            beatIndex++;
            nextTickTime += beatDur;
        }
        schedulerId = setTimeout(schedule, 25);
    }

    function start() {
        const c = ensureCtx();
        if (c.state === "suspended") c.resume();
        if (running) return;
        running = true;
        beatIndex = 0;
        nextTickTime = c.currentTime + 0.1;
        schedule();
    }

    function stop() {
        running = false;
        if (schedulerId) { clearTimeout(schedulerId); schedulerId = null; }
    }

    function onBeat(fn) { beatListeners.add(fn); return () => beatListeners.delete(fn); }

    return { start, stop, setTempo, onBeat, isRunning: () => running, getTempo: () => tempo };
}

window.AudioTools = {
    API_BASE,
    apiGet,
    apiPostJson,
    apiDelete,
    analyzeBlob,
    useMic,
    recordForMs,
    createMetronomeEngine,
    pickRecorderMime,
};