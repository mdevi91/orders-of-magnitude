# Officer portrait

64x64 retro-anime comms officer for dialogue. Not wired into the game yet.

- `officer64_sheet_transparent.png` — 256x192 sheet. Columns: idle, talk_a, talk_b, blink. Rows: normal, determined, alarmed.
- `officer64_sheet.png` — same, baked on black. `officer64_preview.png` — 5x preview.
- `portrait.js` — `Portrait` class: `setMood()`, `setTalking()`, `update(dt)`, `draw(ctx, x, y, scale)`.
- `background.js` — animated ship-interior backdrop per mood (siren on alarmed): `drawShipBackground` before the portrait, `drawMoodOverlay` after. Draw both at 64x64 and scale up.
- `demo.html` — talking demo with mood buttons. Serve this folder (`python3 -m http.server`) and open `demo.html`.
- `gen_officer64.py` — rebuilds the sheets: `python3 gen_officer64.py .` (needs Pillow).
