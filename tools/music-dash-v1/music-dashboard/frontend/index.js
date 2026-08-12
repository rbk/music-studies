const { useEffect } = React;

function App() {
    useEffect(() => {
        document.title = "Music Dashboard";
    }, []);
    return <Dashboard />;
}

// babel-standalone fetches external text/babel scripts asynchronously and may
// execute them out of document order. Wait until every component global is
// defined before mounting, otherwise the first render throws and root stays
// empty.
const REQUIRED = ["useLocalStorage" in window ? null : "useLocalStorage",
    "ChordDiagram", "Card", "Metronome", "Tempo", "Timbre", "Chords",
    "KeyDetector", "StyleDetector", "DrumSessions", "Dashboard"].filter(Boolean);

function mount() {
    const container = document.getElementById("root");
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
}

function waitAndMount(tries = 0) {
    if (REQUIRED.every((n) => typeof window[n] !== "undefined")) {
        mount();
    } else if (tries > 200) {
        // ~10s waited; mount anyway so React surfaces the missing-component error.
        console.error("Components never loaded:", REQUIRED.filter(
            (n) => typeof window[n] === "undefined"));
        mount();
    } else {
        setTimeout(() => waitAndMount(tries + 1), 50);
    }
}

waitAndMount();