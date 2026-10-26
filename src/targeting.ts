// Targeting mode: Q, then click a hostile to lock it. Auto weapons, missiles and hangar craft go for the lock first;
// a click on empty space clears it. The lock gets a reticle in the fight and a readout card with what is known about it.
import { sfx } from './audio';
import { T, ewOf } from './catalog';
import { BS, TAU } from './grid';
import { wpos } from './ships';
import { G } from './state';
import type { BlockType, Ship } from './types';
import { $, H, PX, W, hctx } from './view';

/** The lock, if it is still worth shooting at. */
export const locked = (): Ship | null => {
  const s = G.lock;
  return s && s.alive && !((s.warp || 0) > 0) ? s : null;
};
/** World point under a canvas point. */
const toWorld = (x: number, y: number): [number, number] => [(x - W/2)/G.zoom + G.camX, (y - H/2)/G.zoom + G.camY];
/** The hostile under a canvas point: any of its blocks within reach of the point, or a craft close to it. */
export function shipAt(x: number, y: number): Ship | null {
  const [wx, wy] = toWorld(x, y), pad = Math.max(BS*.9, 6/G.zoom);
  let best: Ship | null = null, bd = 1e18;
  for (const s of G.ships){
    if (!s.alive || s.team !== 'e' || (s.warp || 0) > 0) continue;
    const d0 = Math.hypot(s.x - wx, s.y - wy); if (d0 > s.r + pad*2) continue;
    if (s.craft){ if (d0 < pad*1.6 && d0 < bd){ bd = d0; best = s; } continue; }
    for (const b of s.blocks.values()){ const [bx, by] = wpos(s, b), d = Math.hypot(bx - wx, by - wy); if (d < pad && d < bd){ bd = d; best = s; } }
  }
  return best;
}
export function toggleTargeting(){
  G.tgtMode = !G.tgtMode;
  sfx('pd', G.tgtMode ? 1 : .5);
}
/** A click while targeting: lock what is under it, or clear the lock on empty space. Either way targeting ends. */
export function targetClick(x: number, y: number){
  const s = shipAt(x, y);
  G.lock = s; G.lockT = G.time; G.tgtMode = false;
  sfx(s ? 'dock' : 'pd', s ? 1 : .5);
}

// a designation per ship, so the card reads like a sensor log
const names = new WeakMap<Ship, string>();
const desig = (s: Ship) => {
  let n = names.get(s);
  if (!n){ n = ['HX','KV','TR','VX','OR','ZD'][(Math.random()*6)|0] + '-' + String(100 + ((Math.random()*900)|0)); names.set(s, n); }
  return n;
};
export function shipClass(s: Ship){
  if (s.craft) return s.kind === 'bbay' ? 'Bomber' : 'Fighter';
  if (s.station) return 'Starbase';
  if (s.flag) return 'Flagship';
  if (s.boss) return 'Capital ship';
  const n = s.n0 || s.blocks.size;
  const c = n < 20 ? 'Corvette' : n < 60 ? 'Frigate' : n < 150 ? 'Cruiser' : n < 350 ? 'Destroyer' : 'Dreadnought';
  return s.elite ? 'Elite ' + c.toLowerCase() : c;
}
const threat = (s: Ship) => {
  const g = s.guns.length + 2*s.bays.length;
  return g < 4 ? ['Low', ''] : g < 10 ? ['Moderate', ''] : g < 24 ? ['High', 'red'] : ['Extreme', 'red'];
};

// ---------- drawing, on the full-resolution layer ----------
const RED = '#ff3b2f', ORANGE = '#ff8a00', PAPER = '#fff4e6';
function brackets(X: number, Y: number, R: number, col: string, spin: number, len: number, w: number){
  hctx.strokeStyle = col; hctx.lineWidth = w; hctx.lineCap = 'square';
  for (let q = 0; q < 4; q++){
    const a = spin + q*TAU/4 + TAU/8, cx = X + Math.cos(a)*R, cy = Y + Math.sin(a)*R;
    const ux = -Math.cos(a), uy = -Math.sin(a), tx = -uy, ty = ux;
    hctx.beginPath(); hctx.moveTo(cx + tx*len, cy + ty*len); hctx.lineTo(cx, cy); hctx.lineTo(cx - tx*len, cy - ty*len); hctx.stroke();
  }
}
function hexagon(X: number, Y: number, R: number, rot: number){
  hctx.beginPath();
  for (let q = 0; q <= 6; q++){ const a = rot + q*TAU/6; q ? hctx.lineTo(X + Math.cos(a)*R, Y + Math.sin(a)*R) : hctx.moveTo(X + Math.cos(a)*R, Y + Math.sin(a)*R); }
}
function tag(X: number, Y: number, text: string, bg: string, fg: string){
  hctx.font = '600 12px Oswald, "Arial Narrow", sans-serif'; hctx.textAlign = 'left'; hctx.textBaseline = 'middle';
  const w = hctx.measureText(text).width + 12;
  hctx.fillStyle = bg; hctx.fillRect(X, Y - 9, w, 18);
  hctx.fillStyle = fg; hctx.fillText(text, X + 6, Y + 1);
  hctx.textBaseline = 'alphabetic';
}
/** Reticles: hovered hostiles while targeting, and the lock. Canvas coordinates come in through sx/sy. */
export function drawTargeting(sx: (x: number) => number, sy: (y: number) => number){
  const t = G.time, z = G.zoom*PX, p = G.player;
  const scr = (s: Ship): [number, number, number] => [sx(s.x)*PX, sy(s.y)*PX, Math.max(14, s.r*z*.8 + 8)];
  hctx.save();
  if (G.tgtMode){
    // tint the edges and tick every hostile, so the mode reads at a glance
    const g = hctx.createRadialGradient(W*PX/2, H*PX/2, Math.min(W, H)*PX*.35, W*PX/2, H*PX/2, Math.max(W, H)*PX*.75);
    g.addColorStop(0, 'rgba(255,138,0,0)'); g.addColorStop(1, 'rgba(255,90,0,.22)');
    hctx.fillStyle = g; hctx.fillRect(0, 0, W*PX, H*PX);
    const hov = G.mouse.has ? shipAt(G.mouse.x, G.mouse.y) : null;
    for (const s of G.ships){
      if (!s.alive || s.team !== 'e' || (s.warp || 0) > 0) continue;
      const [X, Y, R] = scr(s);
      if (s === hov){
        brackets(X, Y, R + 4 + 2*Math.sin(t*10), ORANGE, 0, Math.min(14, R*.5), 3);
        tag(X + R*.75 + 8, Y - R*.75 - 4, 'LOCK ' + shipClass(s).toUpperCase(), ORANGE, '#000');
      } else { hctx.globalAlpha = .55; brackets(X, Y, R, ORANGE, 0, Math.min(7, R*.3), 1.5); hctx.globalAlpha = 1; }
    }
    // the cursor: a crosshair in place of the aim
    if (G.mouse.has){
      const mx = G.mouse.x*PX, my = G.mouse.y*PX;
      hctx.strokeStyle = hov ? ORANGE : PAPER; hctx.lineWidth = 1.5;
      hctx.beginPath(); hctx.moveTo(mx - 14, my); hctx.lineTo(mx - 5, my); hctx.moveTo(mx + 5, my); hctx.lineTo(mx + 14, my);
      hctx.moveTo(mx, my - 14); hctx.lineTo(mx, my - 5); hctx.moveTo(mx, my + 5); hctx.lineTo(mx, my + 14); hctx.stroke();
    }
  }
  const L = locked();
  if (L){
    const [X, Y, R] = scr(L), k = Math.min(1, (t - G.lockT)/.35), Rk = R + 4 + 40*(1 - k);
    // closing in when it locks, then turning slowly: red brackets outside, an orange hexagon inside
    hctx.globalAlpha = .25 + .75*k; brackets(X, Y, Rk, RED, t*.6, Math.min(16, R*.5), 3);
    hctx.strokeStyle = ORANGE; hctx.lineWidth = 1.5; hctx.setLineDash([6, 5]); hexagon(X, Y, Rk*.82, -t*.4); hctx.stroke(); hctx.setLineDash([]);
    hctx.fillStyle = RED; hctx.beginPath(); hctx.arc(X, Y, 2.5, 0, TAU); hctx.fill();
    hctx.globalAlpha = 1;
    // a faint tether from the ship
    if (p && p.alive){
      hctx.strokeStyle = 'rgba(255,59,47,.35)'; hctx.lineWidth = 1; hctx.setLineDash([2, 6]);
      hctx.beginPath(); hctx.moveTo(sx(p.x)*PX, sy(p.y)*PX); hctx.lineTo(X, Y); hctx.stroke(); hctx.setLineDash([]);
    }
    const on = X > -R && Y > -R && X < W*PX + R && Y < H*PX + R;
    if (on) tag(X + Rk*.75 + 6, Y - Rk*.75 - 6, 'TARGET', RED, '#000');
    else {
      // off screen: a red marker on the edge, pointing at it
      const cx = W*PX/2, cy = H*PX/2, a = Math.atan2(Y - cy, X - cx), m = 28;
      const ex = Math.min(W*PX - m, Math.max(m, X)), ey = Math.min(H*PX - m, Math.max(m + 60*PX/PX, Y));
      hctx.save(); hctx.translate(ex, ey); hctx.rotate(a); hctx.fillStyle = RED;
      hctx.beginPath(); hctx.moveTo(12, 0); hctx.lineTo(-8, 9); hctx.lineTo(-3, 0); hctx.lineTo(-8, -9); hctx.closePath(); hctx.fill(); hctx.restore();
    }
  }
  hctx.restore();
}

// ---------- the target card and the targeting banner (DOM) ----------
let cardAt = 0, shown = '';
export function syncTargeting(){
  const fight = G.mode === 'combat', L = fight ? locked() : null;
  if (G.lock && !L && fight && !(G.lock.warp || 0)){ G.lock = null; }
  const banner = $('tgtBanner'), card = $('tgtCard');
  const bOn = fight && G.tgtMode;
  if (banner.hidden === bOn) banner.hidden = !bOn;
  if (!L){ if (!card.hidden) card.hidden = true; shown = ''; return; }
  if (card.hidden) card.hidden = false;
  if (G.time - cardAt < .1 && shown === desig(L)) return;
  cardAt = G.time; shown = desig(L);
  const p = G.player, dist = p ? Math.max(0, Math.hypot(L.x - p.x, L.y - p.y) - L.r - p.r)/BS : 0, spd = Math.hypot(L.vx, L.vy)/BS;
  const hp = L.lifeMax ? Math.max(0, L.life/L.lifeMax) : 1, [th, thc] = threat(L);
  const kinds = new Map<string, number>();
  for (const g of L.guns){ const w = ewOf(g.t); if (w) kinds.set(g.t, (kinds.get(g.t) || 0) + 1); }
  const arms = [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${n}× ${(T[t as BlockType]?.name || t).toUpperCase()}`).join(' · ') || 'NONE';
  card.innerHTML =
    `<div class="tc-head"><span class="tag">Target</span><span class="tc-id">${desig(L)}</span></div>` +
    `<b class="tc-name">${shipClass(L)}</b>` +
    `<div class="tc-bar"><i style="width:${(hp*100).toFixed(1)}%"></i></div>` +
    `<dl><dt>Integrity</dt><dd>${Math.round(hp*100)}%</dd><dt>Blocks</dt><dd>${L.blocks.size} / ${L.n0 || L.blocks.size}</dd>` +
    `<dt>Guns</dt><dd>${L.guns.length}</dd><dt>Shields · PD</dt><dd>${L.shields.length} · ${L.epd.length}</dd>` +
    (L.bays.length ? `<dt>Hangar bays</dt><dd>${L.bays.length}</dd>` : '') +
    `<dt>Range</dt><dd>${Math.round(dist)} m</dd><dt>Speed</dt><dd>${spd.toFixed(1)} m/s</dd>` +
    `<dt>Threat</dt><dd class="${thc}">${th.toUpperCase()}</dd></dl>` +
    `<p class="tc-arms">${arms}</p>`;
}
