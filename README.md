# Scripture Caster

Live AI scripture detection and presentation for church services. Listens to a
mic feed, detects scripture references (explicit or quoted-without-reference),
and pushes the verse to a fullscreen output window an operator confirms before
it goes live — same operator/output split as EasyWorship or ProPresenter, so it
projects directly or feeds OBS as a Window Capture source.

## Structure

```
scripture-caster/
├── src/
│   ├── main/            Electron main process — creates both windows, owns IPC
│   ├── preload/         Context-bridge API exposed to renderers as window.scriptureCaster
│   ├── shared/          Types + IPC channel names, imported by all three processes
│   ├── lib/
│   │   ├── detection/   referenceParser.ts (explicit refs), semanticMatcher.ts (quoted verses) — TODO
│   │   └── bible/       Local KJV corpus + lookup — TODO
│   └── renderer/
│       ├── operator/    Control console — plain HTML/CSS/JS (no React needed here).
│       │                Combined/Split output modes, LOGO/BLACK/CLEAR, alerts modal,
│       │                today's order, filmstrip with real verse text, AI detection
│       │                feed, staged→live flow. "Push live" calls the real IPC bridge.
│       └── output/      Fullscreen display window (React) — this is what you project
│                        or OBS-capture. Listens for state changes from the operator.
├── electron.vite.config.ts   Two renderer entry points (operator, output)
└── package.json
```

## Status

The operator console UI is fully built out and wired to real IPC — clicking a
verse in the filmstrip stages it, "Push live" sends it to the actual output
window via `window.scriptureCaster.pushLive()`, and the output window updates
live. Right now the verses shown are hardcoded demo data (`verseData` in
`operator/index.html`) — the next step is replacing that with real detection.

## Next steps

1. `npm install`
2. `npm run dev` — opens both windows. Click a filmstrip card, then "Push
   live," and confirm the output window updates. Drag the output window onto
   your second display or add it in OBS as a Window Capture source.
3. Wire mic capture + streaming STT into the operator renderer (start with the
   Web Speech API for the MVP) in place of the hardcoded `verseData`.
4. Fill in `referenceParser.ts` — spoken-number normalization + book-name
   fuzzy matching (STT commonly mishears book names).
5. Load the KJV corpus into SQLite/Postgres with `pgvector` for the semantic
   quote-matching path, and replace the demo filmstrip/queue with real
   detection results.
