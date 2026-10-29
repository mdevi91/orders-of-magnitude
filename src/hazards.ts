import { sfx } from './audio';
import { ESH, T } from './catalog';
import { BS, TAU, rand } from './grid';
import { boomAt, damage, hitShip, sparks } from './ships';
import { ionJam } from './update';
import { G } from './state';
import type { Hazard } from './types';
import { REDUCE } from './view';

// ---------- battle hazards ----------
// Now and then a fight happens somewhere nasty. From sector 2, about one ordinary fight in eight (never a capital
// fight or a test simulation) rolls one of these, announced a few seconds in, hitting both sides alike:
// - asteroid hail: rocks stream across the field from one side, smashing into any hull; shots break them up, and
//   they stop enemy rounds too, so they double as cover
// - ion storm: lightning strikes around the player, jamming the weapons near each strike and scorching the block
// - solar flare: every so often a warning, then a pulse that pops every shield bubble and drains half the player's energy
export const HAZ_CHANCE = .125;
export const HAZARDS = {
  rocks: {name:'Asteroid hail', sub:'Rocks incoming: shoot them or use them as cover'},
  storm: {name:'Ion storm', sub:'Lightning jams the guns near where it strikes'},
  flare: {name:'Solar flare', sub:'Flares knock out every shield and drain energy'},
} as const;
export type HazardKind = keyof typeof HAZARDS;

/** Rolls a hazard for a fight just started (none in the test build unless a test asks for one). */
export function rollHazard(){
  G.hz = null;
  if (G.sim || G.stage < 2 || G.fight==='boss' || G.fight==='station' || import.meta.env.MODE === 'test') return;
  if (Math.random() < HAZ_CHANCE) startHazard((Object.keys(HAZARDS) as HazardKind[])[(Math.random()*3)|0]);
}
export function startHazard(kind: HazardKind){
  // the rocks come from one side for the whole fight
  G.hz = {kind, t:3.5, on:false, dir:rand(0, TAU), rocks:[], bolts:[], warn:0, flash:0};
}

const span = () => Math.max(G.span || 600, 400);
export function updateHazard(dt: number){
  const H = G.hz, p = G.player; if (!H || !p) return;
  // the announcement, a few seconds into the fight once the opening banner has gone
  if (!H.on){ if ((H.t -= dt) > 0) return; H.on = true; H.t = 1; G.banner = {text:HAZARDS[H.kind].name, sub:HAZARDS[H.kind].sub, t:2.4, red:true}; sfx('lowEn'); }
  H.flash = Math.max(0, H.flash - dt*2.5);
  for (const b of H.bolts) b.life -= dt;
  H.bolts = H.bolts.filter(b => b.life > 0);
  if (H.kind==='rocks') rocks(H, dt);
  else if (H.kind==='storm'){
    if ((H.t -= dt) <= 0){
      H.t = rand(1.6, 3.2);
      // strike near the player, or near a random enemy ship nearby
      const near = G.ships.filter(s => s.alive && !s.craft && Math.hypot(s.x-p.x, s.y-p.y) < span()*1.2);
      const s = Math.random() < .55 || !near.length ? p : near[(Math.random()*near.length)|0], R = span()*.35;
      strike(s.x + rand(-R, R), s.y + rand(-R, R));
    }
  } else if (H.kind==='flare'){
    if (H.warn > 0){ if ((H.warn -= dt) <= 0) flare(); }
    else if ((H.t -= dt) <= 0){ H.t = rand(13, 18); H.warn = 2.5; G.banner = {text:'Flare incoming', sub:'Shields will drop', t:2, red:true}; }
  }
}
function rocks(H: Hazard, dt: number){
  const p = G.player!, SC = G.SC, D = span(), ux = Math.cos(H.dir), uy = Math.sin(H.dir);
  // a steady hail with gusts: up to 40 rocks in the air
  if ((H.t -= dt) <= 0 && H.rocks.length < 40){
    H.t = rand(.25, .7)*(Math.sin(G.time*.35) > .3 ? .5 : 1);
    const off = rand(-1, 1)*D*1.1, r = rand(4, 13)*SC, sp = rand(120, 230)*SC*(13*SC/r)**.3;
    const a = H.dir + rand(-.15, .15);
    H.rocks.push({x:p.x - ux*D*1.3 - uy*off, y:p.y - uy*D*1.3 + ux*off, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r, hp:r/SC*2.2, a:rand(0, TAU), w:rand(-2, 2),
      shape:Array.from({length:7}, () => rand(.72, 1.12))});
  }
  for (const R of H.rocks){
    R.x += R.vx*dt; R.y += R.vy*dt; R.a += R.w*dt;
    // smashes into the first hull it touches, breaking up
    for (const s of G.ships){
      if (!s.alive || (s.warp || 0) > 0) continue;
      const k = hitShip(s, R.x, R.y, R.r*.8);
      if (k >= 0){ damage(s, k, R.r/SC*1.6); if (s===p){ sfx('hit'); if (!REDUCE) G.shake = Math.min(4, G.shake + R.r/SC*.15); } smash(H, R); break; }
    }
    if (R.hp <= 0) continue;
    // shots on either side break rocks up; a rock soaks up whatever hits it
    for (const b of G.pb) if (!b.dead && (b.x-R.x)**2 + (b.y-R.y)**2 < (R.r + b.r)**2){ b.dead = true; R.hp -= b.dmg; if (R.hp <= 0){ smash(H, R); break; } }
    if (R.hp > 0) for (const b of G.eb) if (!b.dead && (b.x-R.x)**2 + (b.y-R.y)**2 < (R.r + b.r)**2){ b.dead = true; R.hp -= b.dmg; if (R.hp <= 0){ smash(H, R); break; } }
  }
  // gone once broken or well past the player
  H.rocks = H.rocks.filter(R => R.hp > 0 && (R.x-p.x)*ux + (R.y-p.y)*uy < D*1.6);
}
/** A rock breaks up: a puff of dust, and a big one sheds two smaller rocks. */
function smash(H: Hazard, R: Hazard['rocks'][number]){
  R.hp = 0; boomAt(R.x, R.y, R.r*1.2, .3); sparks(R.x, R.y, 0, 6, 90*G.SC, ['#8a7a66','#c8b8a0','#ffffff']); sfx('boom', .3);
  if (R.r > 8*G.SC) for (const q of [-1, 1]){
    const a = Math.atan2(R.vy, R.vx) + q*rand(.4, .9), sp = Math.hypot(R.vx, R.vy)*.8, r = R.r*.5;
    H.rocks.push({x:R.x, y:R.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r, hp:r/G.SC*2.2, a:rand(0, TAU), w:rand(-3, 3), shape:Array.from({length:7}, () => rand(.72, 1.12))});
  }
}
/** Lightning: every ship within reach of the strike has the weapons near it jammed and takes a scorch on the nearest block. */
function strike(x: number, y: number){
  const H = G.hz!, reach = 3*BS*G.SC;
  H.bolts.push({x, y, life:.35, seed:Math.random()*99});
  sfx('rail', .6); boomAt(x, y, 14*G.SC, .25);
  sparks(x, y, 0, 10, 160*G.SC, ['#a070ff','#e8dcff','#ffffff']);
  for (const s of G.ships){
    if (!s.alive || (s.warp || 0) > 0) continue;
    const k = hitShip(s, x, y, reach); if (k < 0) continue;
    const b = s.blocks.get(k)!; ionJam(s, b); damage(s, k, 8);
  }
}
/** A flare: every shield bubble on the field pops, and the player loses half its energy. */
function flare(){
  const H = G.hz!, p = G.player!;
  H.flash = 1; sfx('pop');
  for (const s of G.ships){
    if (!s.alive) continue;
    for (const sh of s.shields){ const B = sh.bub; if (B && B.hp > 0){ B.hp = 0; B.down = s.team==='p' ? T.shield.sh!.down*.6 : ESH.down*.6; } }
  }
  p.en *= .5;
  if (!REDUCE) G.shake = Math.min(4, G.shake + 2);
}

/** Draws the rocks and lightning in world space through sx/sy, and the flare's white-out over the screen. */
export function drawHazard(X: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, z: number, W: number, H0: number){
  const H = G.hz; if (!H || !H.on) return;
  for (const R of H.rocks){
    const n = R.shape.length, cx = sx(R.x), cy = sy(R.y), r = R.r*z;
    X.fillStyle = '#5a4e42'; X.beginPath();
    for (let q=0; q<n; q++){ const a = R.a + q*TAU/n; X[q ? 'lineTo' : 'moveTo'](cx + Math.cos(a)*r*R.shape[q], cy + Math.sin(a)*r*R.shape[q]); }
    X.closePath(); X.fill();
    // a lit face toward the star and a couple of craters
    X.fillStyle = '#8a7a66'; X.beginPath(); X.arc(cx - r*.2, cy - r*.2, r*.55, 0, TAU); X.fill();
    X.fillStyle = '#3a322a'; X.fillRect(Math.round(cx + r*.15), Math.round(cy + r*.1), Math.max(1, r*.25), Math.max(1, r*.25));
    X.fillRect(Math.round(cx - r*.45), Math.round(cy + r*.3), Math.max(1, r*.18), Math.max(1, r*.18));
  }
  for (const b of H.bolts){
    const cx = sx(b.x), cy = sy(b.y), L = 160*G.SC*z, k = b.life/.35;
    X.globalAlpha = k; X.strokeStyle = '#e8dcff'; X.lineWidth = 2;
    // a jagged bolt down from the top of the screen into the strike
    X.beginPath(); X.moveTo(cx + Math.sin(b.seed)*L*.3, cy - L*2);
    for (let q=1; q<=6; q++){ const f = q/6; X.lineTo(cx + Math.sin(b.seed*q)*L*.25*(1-f), cy - L*2*(1-f)); }
    X.stroke(); X.strokeStyle = '#a070ff'; X.lineWidth = 5; X.globalAlpha = k*.35; X.stroke();
    X.globalAlpha = 1;
  }
  if (H.flash > 0){ X.globalAlpha = H.flash*.6; X.fillStyle = '#fff4d8'; X.fillRect(0, 0, W, H0); X.globalAlpha = 1; }
  if (H.warn > 0){ X.globalAlpha = .12 + .1*Math.sin(G.time*14); X.fillStyle = '#ffb040'; X.fillRect(0, 0, W, H0); X.globalAlpha = 1; }
}
