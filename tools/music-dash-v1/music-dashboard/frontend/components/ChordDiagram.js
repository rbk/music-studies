// ChordDiagram renders a guitar chord fingering as inline SVG.
// fingering: array of 6 numbers, low-E to high-E:
//   -1 = muted, 0 = open, N = fretted at fret N.
// We render 5 frets starting from the lowest non-zero fret (with a capo bar).

function ChordDiagram({ fingering, name }) {
    if (!fingering || fingering.length !== 6) {
        return <div className="muted">no diagram</div>;
    }

    const frets = 5;
    const strings = 6;
    const cellW = 34;
    const cellH = 38;
    const padX = 26;
    const padTop = 40;
    const padBottom = 18;
    const W = padX * 2 + cellW * (frets);
    const H = padTop + cellH * frets + padBottom;

    // Determine base fret: lowest fretted fret. If > 1, draw a capo bar and
    // shift finger numbers relative to it; otherwise frets start at the nut.
    const fretted = fingering.filter((f) => f > 0);
    const minFret = fretted.length ? Math.min(...fretted) : 1;
    const baseFret = minFret > 1 ? minFret : 1;
    const showBarre = minFret > 1;

    // Fret position for a finger value (0 = open above nut).
    function fretRow(f) {
        if (f <= 0) return -1;
        return f - baseFret + 1; // 1..5 within the grid
    }

    const stringX = (i) => padX + i * cellW;
    const fretY = (r) => padTop + r * cellH;

    return (
        <div className="diagram-wrap">
            <svg className="chord-diagram" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                <text x={W / 2} y={20} textAnchor="middle" fill="#d7dde5"
                      fontSize="18" fontWeight="700">{name || ""}</text>

                {/* nut or capo bar */}
                {showBarre ? (
                    <rect x={stringX(0) - 6} y={fretY(0) - 6} width={stringX(strings - 1) - stringX(0) + 12}
                          height={5} rx="2" fill="#44bce7"/>
                ) : (
                    <rect x={stringX(0) - 6} y={fretY(0) - 6} width={stringX(strings - 1) - stringX(0) + 12}
                          height={5} fill="#d7dde5"/>
                )}

                {/* fret label (base fret) */}
                {showBarre && (
                    <text x={padX - 16} y={fretY(0) + 22} textAnchor="middle"
                          fill="#8a94a3" fontSize="13">{baseFret}</text>
                )}

                {/* fret lines */}
                {Array.from({ length: frets + 1 }).map((_, r) => (
                    <line key={"f" + r} x1={stringX(0)} y1={fretY(r)}
                          x2={stringX(strings - 1)} y2={fretY(r)}
                          stroke="#3a424d" strokeWidth="1.5"/>
                ))}
                {/* strings */}
                {Array.from({ length: strings }).map((_, i) => (
                    <line key={"s" + i} x1={stringX(i)} y1={fretY(0)}
                          x2={stringX(i)} y2={fretY(frets)}
                          stroke="#3a424d" strokeWidth={i === 0 ? 2 : 1}/>
                ))}

                {/* dots / open / muted markers */}
                {fingering.map((f, i) => {
                    const cx = stringX(i);
                    if (f < 0) {
                        // muted: small x above nut
                        return (
                            <text key={"m" + i} x={cx} y={fretY(0) - 12}
                                  textAnchor="middle" fill="#8a94a3" fontSize="13">×</text>
                        );
                    }
                    if (f === 0) {
                        return (
                            <circle key={"o" + i} cx={cx} cy={fretY(0) - 18} r="5.5"
                                    fill="none" stroke="#d7dde5" strokeWidth="1.5"/>
                        );
                    }
                    const r = fretRow(f);
                    if (r < 1 || r > frets) return null;
                    const cy = fretY(r) - cellH / 2;
                    return (
                        <circle key={"d" + i} cx={cx} cy={cy} r="9"
                                fill="#44bce7" stroke="#0b0d10" strokeWidth="1.5"/>
                    );
                })}
            </svg>
        </div>
    );
}

window.ChordDiagram = ChordDiagram;