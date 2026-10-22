# Orders of Magnitude

Single-file browser game (canvas, pixel-art blueprint style), hosted on Firebase.

- `src/orders-of-magnitude.html` — **source of truth**. Artifact-style page: starts at `<title>`, no doctype/head/body. All CSS and JS inline.
- `public/index.html` — build output. Do not edit by hand.
- `build.sh src/orders-of-magnitude.html` — wraps source into a full document and syntax-checks the inline script with `node --check`.
- Deploy: `firebase deploy --only hosting` (sites `orders-of-magnitude` and redirect site `orders-of-magnitude-game`).
- Tests: `node test/run.js [name ...]` builds, injects each `test/*.test.js` into the game's scope and runs it in headless Chrome (`CHROME=` to pick a browser). `difficulty` is a bot balance probe: it logs win rates per sector and fight type; rerun it after balance changes.
