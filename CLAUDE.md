# Orders of Magnitude

Browser game (canvas, pixel-art blueprint style) in TypeScript, built with Vite, hosted on Firebase.

- `index.html` — page shell and markup. `src/styles.css` — all styles.
- `src/*.ts` — the game, one module per area: `catalog` (blocks, weapons, craft), `state` (the `G` game state), `ships`/`physics`/`bullets`, `fights`/`update`/`craft` (combat), `starmap`/`loot`/`events`/`shop`/`runs` (the run), `draw`/`mapdraw`/`loop` (rendering), `editor`/`input`/`controls`/`ui`/`groups`/`tutorial`/`save`/`blueprints`/`audio`. Shared shapes live in `src/types.ts`. Start-up wiring sits in each module's `init()`, called in order from `main.ts`.
- Strict TypeScript: `npm run typecheck`. Avoid module-level code that reads another module's exports at load time (import cycles); put it in `init()` instead.
- `npm run build` — typecheck, then build into `public/` (generated, not committed). `npm run dev` for a live dev server.
- Deploy: `npm run build && firebase deploy --only hosting` (sites `orders-of-magnitude` and redirect site `orders-of-magnitude-game`).
- Tests: `npm test` (or `node test/run.js [name ...]`) builds in test mode, serves it locally and runs each `test/*.test.js` in headless Chrome inside `with (OOM)`, so every module export is in scope (`CHROME=` to pick a browser). Tests can't reassign module bindings; change state through `G` or the game's functions. `difficulty` is a bot balance probe: it logs win rates per sector and fight type; rerun it after balance changes.
