// Animated ship-interior background for the comm portrait.
// Draws at sprite resolution (1 unit = 1 pixel) so it stays pixel-art when scaled.

const STARS = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37) % 11,
  y: (i * 53) % 22,
  speed: 1 + (i % 3) * 1.5,
  bright: i % 3 === 0,
}));

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// cheap deterministic flicker
function noise(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function drawShipBackground(ctx, t, mood = "normal", size = 64) {
  const k = size / 64;
  ctx.save();
  ctx.scale(k, k);

  // bulkhead + panel seams
  px(ctx, 0, 0, 64, 64, "#1c0608");
  for (const x of [0, 16, 32, 48]) {
    px(ctx, x, 0, 1, 64, "#2c0c0e");
    px(ctx, x + 2, 6, 1, 1, "#4a1614");
    px(ctx, x + 2, 50, 1, 1, "#4a1614");
  }

  // ceiling struts, like the hub
  ctx.strokeStyle = "#a8261a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(22, 0);
  ctx.moveTo(64, 14); ctx.lineTo(42, 0);
  ctx.stroke();

  // ceiling light strip
  const lightOn = mood === "determined" ? noise(Math.floor(t * 12)) > 0.25 : true;
  px(ctx, 24, 0, 16, 1, lightOn ? "#fff1c4" : "#5a3020");

  // viewport with drifting stars (left wall)
  px(ctx, 0, 16, 13, 26, "#5a1a14");
  px(ctx, 1, 17, 11, 24, "#07030c");
  const drift = mood === "alarmed" ? 6 : 1;
  for (const s of STARS) {
    const x = 1 + ((s.x - t * s.speed * drift) % 11 + 11) % 11;
    const len = mood === "alarmed" && s.bright ? 3 : 1;
    px(ctx, Math.floor(x), 18 + s.y, len, 1, s.bright ? "#fff1c4" : "#7a6a8a");
  }

  // console with blinking lights (right wall)
  px(ctx, 51, 18, 13, 26, "#3a0e10");
  px(ctx, 52, 19, 11, 24, "#14080a");
  const rate = mood === "normal" ? 2 : mood === "determined" ? 6 : 10;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      const on = noise(r * 7 + c * 3 + Math.floor(t * rate) * 0.37) > 0.5;
      let color;
      if (mood === "alarmed") color = on ? "#ff3020" : "#3a0a08";
      else if (mood === "determined") color = on ? (c === 1 ? "#ff8a1f" : "#ffd246") : "#2a1408";
      else color = on ? (c === 2 ? "#ff8a1f" : "#5cffb0") : "#103020";
      px(ctx, 54 + c * 3, 21 + r * 3, 2, 1, color);
    }
  }

  // siren: rotating beacon light sweeping the room
  if (mood === "alarmed") {
    const a = t * 6;
    const sweep = (Math.cos(a) + 1) / 2;
    ctx.fillStyle = `rgba(255, 20, 10, ${0.15 + sweep * 0.45})`;
    ctx.fillRect(0, 0, 64, 64);
    // beam cone from the top-left beacon
    ctx.fillStyle = `rgba(255, 60, 30, ${0.35 * sweep})`;
    ctx.beginPath();
    ctx.moveTo(4, 3);
    ctx.lineTo(4 + Math.cos(a) * 90 - 10, 3 + 60);
    ctx.lineTo(4 + Math.cos(a) * 90 + 10, 3 + 60);
    ctx.closePath();
    ctx.fill();
    px(ctx, 2, 1, 5, 4, sweep > 0.5 ? "#ff3020" : "#7a1008");
    px(ctx, 3, 2, 3, 2, sweep > 0.5 ? "#ffd0a0" : "#ff3020");
  }

  ctx.restore();
}

// Light spill on top of the portrait (call after drawing it).
export function drawMoodOverlay(ctx, t, mood = "normal", size = 64) {
  if (mood !== "alarmed") return;
  const sweep = (Math.cos(t * 6) + 1) / 2;
  ctx.fillStyle = `rgba(255, 0, 0, ${0.08 + sweep * 0.18})`;
  ctx.fillRect(0, 0, size, size);
}
