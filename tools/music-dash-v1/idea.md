# music dashboard mvp prototype

- verification and e2e testing via tools `agent-browser`, `ffmpeg` 
- think prototype. new subfolder. ui + backend to help a person get better at guitar and timing
- NOTE: chord-detector is example for audio intake, docker not required
- Stack: python flask backend, sqlite db, react via pwa-template style, minimal css, web based app 
- ui as dashboard
  - components (live update in detect)
    - tempo - detect and set mode
    - metronome - set, play, pause
    - timbre - detect and display timbre detected
    - chords - detect and display chord name and diagram e.g. "C6 <diagram chordy-svg>". Show history as horizontal slider with current detection highlighted in middle, can scroll back
    - drum sessions - set tempo, enable metronome, detect audio from speak, display and track accuracy. start/end session. accuracy percentage. list of previous sessions.
    - key detector - detect audio and display possible key
    - music style detector - detect audio and display possible style 

## Tools

- chordy-svg - https://www.npmjs.com/package/chordy-svg
- Flask
- pwa-template

## Notes

- use `tmux` for long-running process to avoid blocking 
- use `pi` coding agent cli where hand-off makes sense for speed
