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
│   │   ├── detection/   books.ts + numbers.ts (spoken-number/book aliases),
│   │   │                referenceParser.ts (explicit refs)
│   │   ├── semantic/    Local embedding engine (@xenova/transformers). Per-translation
│   │   │                verse-index cache on disk; paraphrase search ranks by cosine
│   │   │                similarity
│   │   └── bible/       Local KJV corpus + lookup
│   └── renderer/
│       ├── operator/    Control console (React + zustand). Combined/Split output
│       │                modes, LOGO/BLACK/CLEAR, alerts modal, today's order,
│       │                filmstrip with real verse text, AI detection feed,
│       │                staged→live flow. "Push live" calls the real IPC bridge.
│       └── output/      Fullscreen display window (React) — this is what you project
│                        or OBS-capture. Listens for state changes from the operator.
├── electron.vite.config.ts   Two renderer entry points (operator, output)
└── package.json
```

## Status

The operator console is fully built out in React + zustand and wired to real
IPC — clicking a verse in the filmstrip stages it, "Push live" sends it to the
actual output window via `window.scriptureCaster.pushLive()`, and the output
window updates live. Chapters, translations, search, and the Deepgram live
detection feed all hit the real backend; there is no hardcoded demo data.

Detection has two paths. Explicit spoken references (book, chapter, verse) are
parsed directly, and with AUTO on they push straight to the live screen. The
quoted-without-reference path runs an embedded paraphrase detector
(`all-MiniLM-L6-v2` via `@xenova/transformers`, quantized) that ranks verses by
cosine similarity against a per-translation precomputed index (threshold ~0.5,
top 8); the old token-overlap `paraphraseSearch` remains as a fallback.
Paraphrases only *suggest* — they never auto-push. Both suggestions and feeds
are quiet for 30s after any push (reading lock). The model and verse index are
cached under the app's userData (`semantic/`), so only the first ever run
downloads the model and builds the KJV index (a few minutes). Semantic engine
status (downloading / indexing / errors) shows in the operator console while it
loads.

## Next steps

1. `npm install`
2. `npm run dev` — opens both windows. Click a filmstrip card, then "Push
   live," and confirm the output window updates. Drag the output window onto
   your second display or add it in OBS as a Window Capture source.
3. `npm run typecheck` / `npm run build` before shipping.
4. Expand paraphrase detection: raise/lower the cosine threshold in
   `src/lib/semantic/index.ts` (`semanticSearch`), switch to a larger embedding
   model, or enable the multi-threaded WASM backend to speed up first-time
   indexing.
5. Populate the schedule and songs/media/web library tabs, which are still
   placeholders.
