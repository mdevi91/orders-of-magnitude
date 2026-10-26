import { sfx } from './audio';
import { COL, ESH, ET, HM, LV, PARTS, T, def, ewOf, isCraft, pickWeapon } from './catalog';
import { BS, CORE, FA, K, KI, KJ, NB, angDiff, rand } from './grid';
import { laneFwd, partComplete, physics } from './physics';
import { metaLv } from './runs';
import { G } from './state';
import type { Block, Cell, EnemyCell, Facing, Key, Physics, Ship, Team } from './types';
import { REDUCE } from './view';

// Life: every block adds its hit points times LIFE to the ship's life, and every point of damage a block takes comes off it too.
// At 0 life the whole ship explodes, core or not. Armor plates shrug off part of every hit.
export const LIFE = .6, ARMOR_DR = .3;
const NO_PHYSICS: Physics = {mass:0, inertia:0, torque:0, coreT:0, jetCW:0, jetCCW:0, F:{px:0, nx:0, py:0, ny:0}, engines:[]};

// ---------- ships ----------
export function makeShip(design: Map<Key, Cell>, team: Team, x: number, y: number, hpMul=1, dirs: Map<Key, Facing> | null = null): Ship {
  const s: Ship = {team, x, y, vx:0, vy:0, a:0, c:1, sn:0, blocks:new Map(), alive:true, hpMul, r:0,
    guns:[], pds:[], rails:[], lasers:[], shields:[], bays:[], epd:[], teslas:[],
    ph:NO_PHYSICS, en:0, enMax:0, enRegen:0, w:0,
    boss:false, elite:false, flag:false, station:false, fodder:false, craft:false, n0:design.size, phaseN:1, sc:G.SC,
    fireMul:1, ft:0, phase:0, spin:1, orb:0, orbSpd:0, pref:0, vmax:0, turn:0, value:0, tgt:null, sights:null,
    kind:null, bay:null, sortie:0, aimA:0, cd:0, pick:0, life:0, lifeMax:0};
  for (const [k,t] of design){
    const hp = (team==='e' ? ET[t as EnemyCell].hp : def(t)!.hp!*LV(t)*HM.hp()*(team==='p' && t==='core' ? 1 + .25*metaLv('core') : 1)) * hpMul;
    s.lifeMax += hp*LIFE;
    const b: Block = {t, i:KI(k), j:KJ(k), o:dirs ? dirs.get(k)||0 : 0, hp, max:hp, cd:Math.random()*.4, hit:-1};
    s.blocks.set(k, b);
  }
  s.life = s.lifeMax;
  recalc(s); return s;
}
export function recalc(s: Ship){
  let r = 0; s.guns = []; s.pds = []; s.rails = []; s.lasers = []; s.shields = []; s.bays = []; s.epd = []; s.teslas = [];
  for (const b of s.blocks.values()) r = Math.max(r, Math.hypot(b.i,b.j)*BS + BS*.75);
  s.r = r;
  if (s.team==='a') return; // hangar craft fly and shoot from updateCraft
  if (s.team !== 'p'){
    // enemies: guns, shield bubbles, carrier bays; each generator speeds up their fire
    let gens = 0;
    for (const b of s.blocks.values()){
      if (ewOf(b.t)) s.guns.push(b); else if (b.t==='bay') s.bays.push(b); else if (b.t==='gen') gens++; else if (b.t==='pd') s.epd.push(b);
      else if (b.t==='shield'){ s.shields.push(b); if (!b.bub){ const max = ESH.hp*s.hpMul; b.bub = {hp:max, max, down:0, last:-9, flash:-9}; } }
    }
    s.fireMul = 1 + .2*Math.min(gens, 2); return;
  }
  const typeAt = (k: Key) => s.blocks.get(k)?.t;
  s.ph = physics(s.blocks.values(), typeAt);
  for (const b of s.blocks.values()){
    const d = def(b.t)!;
    // a MIRV fires only while its whole launcher is intact
    if (d.gun && !(PARTS[b.t] && !partComplete(typeAt, b.i, b.j, b.t, b.o))) s.guns.push(b);
    if (d.pd && !(PARTS[b.t] && !partComplete(typeAt, b.i, b.j, b.t, b.o))) s.pds.push(b);
    if (d.tesla) s.teslas.push(b);
    if (b.t==='shield') s.shields.push(b);
    if (PARTS[b.t] && !d.gun && partComplete(typeAt, b.i, b.j, b.t, b.o)){
      if (isCraft(b.t)){ s.bays.push(b); if (b.bt == null) b.bt = 1.5; continue; }
      b.lane = laneFwd(typeAt, b.i, b.j, b.o);
      (b.t==='rail' ? s.rails : s.lasers).push(b);
    }
  }
  // energy: the core gives a little; generators add recharge, batteries add storage
  let cap = 40, regen = 6;
  for (const b of s.blocks.values()){ if (b.t==='gen') regen += T.gen.en!.regen!*LV('gen'); if (b.t==='battery') cap += T.battery.en!.cap!*LV('battery'); }
  // a fresh ship starts with full batteries; losing a battery later only trims what is stored
  const fresh = s.enMax === 0;
  s.enMax = cap*HM.en(); s.enRegen = regen*HM.en(); s.en = fresh ? cap : Math.min(s.en, cap);
  // each shield block keeps its own bubble state
  for (const b of s.shields) if (!b.bub){ const max = T.shield.sh!.hp*LV('shield')*HM.sh(); b.bub = {hp:max, max, down:0, last:-9, flash:-9}; }
}
// Enemy hulls follow a ship silhouette, mirrored left to right with the nose at -j: a half-width profile from bow (t=0)
// to stern (t=1), sometimes with side pods. Guns sit on the outer edge, engines across the stern, armour on bow and flanks.
const PROFILES: ((t: number) => number)[] = [
  t => .2 + .8*t,                                   // dart: widens toward the stern
  t => t < .5 ? .4 : t < .85 ? 1 : .5,              // cruiser: narrow body, swept wings aft
  t => t < .25 ? .3 + 2.4*t : .9 - .3*t,            // frigate: a long even body
  t => t < .3 ? .9 : t < .8 ? .45 : .8,             // hammerhead: wide bow, waist, wide stern
];
function hullShape(n: number){
  const prof = PROFILES[(Math.random()*PROFILES.length)|0], aspect = rand(1.5, 2.3);
  let cells = new Set<Key>();
  for (let s = 1; s < 60 && cells.size < n; s += .25){
    const L = Math.max(2, Math.round(s*aspect)), front = Math.max(1, Math.round(L*.45));
    cells = new Set();
    for (let j = -front; j <= L - front; j++){
      // the bow row tapers to a point
      let hw = Math.round(s*.55*prof((j + front)/L)); if (j === -front) hw = Math.floor(hw/2);
      for (let i = -hw; i <= hw; i++) cells.add(K(i,j));
    }
  }
  // ragged edges: now and then a row ends one cell short (both sides alike)
  const rows = new Map<number, number>();
  for (const k of cells) rows.set(KJ(k), Math.max(rows.get(KJ(k)) ?? 0, KI(k)));
  for (const [j, hw] of rows) if (hw > 1 && j !== 0 && Math.random() < .15){ cells.delete(K(hw,j)); cells.delete(K(-hw,j)); }
  // big hulls may carry side pods on struts
  if (n >= 40 && Math.random() < .5){
    const js = [...rows.keys()], j0 = Math.min(...js), j1 = Math.max(...js), sj = Math.round(j0 + (j1-j0)*rand(.4,.7));
    const span = Math.max(...rows.values()) + 2, len = Math.max(2, Math.round((j1-j0)*.35));
    for (let i = 1; i <= span; i++){ cells.add(K(i,sj)); cells.add(K(-i,sj)); }
    for (let j = sj - Math.floor(len/2); j <= sj + Math.ceil(len/2); j++){ cells.add(K(span,j)); cells.add(K(-span,j)); }
  }
  cells.add(CORE);
  return cells;
}
export function genDesign(n: number, boss: boolean, stage: number, maxGuns=99){
  const cells = hullShape(n), d = new Map<Key, EnemyCell>();
  const pa = Math.min(.6, .2 + .05*stage), pg = boss ? .12 : .15;
  const open = (k: Key, o: number) => !cells.has(k+o), edge = (k: Key) => NB.some(o => open(k,o));
  const twin = (k: Key) => K(-KI(k), KJ(k));
  const set = (k: Key, t: EnemyCell) => { d.set(k,t); d.set(twin(k),t); };
  for (const k of cells) d.set(k, 'hull');
  d.set(CORE, 'core');
  const free = (k: Key) => d.get(k)==='hull' && d.get(twin(k))==='hull';
  // engines across the stern: cells with nothing behind them, rearmost first
  const back = K(0,1) - CORE;
  const stern = [...cells].filter(k => open(k, back) && KI(k) >= 0 && free(k)).sort((a,b) => KJ(b) - KJ(a) || KI(a) - KI(b));
  let ne = Math.min(6, Math.max(1, Math.round(cells.size/16)));
  for (const k of stern){ if (ne <= 0) break; if (!free(k)) continue; set(k,'engine'); ne -= KI(k) ? 2 : 1; }
  // guns on the outer edge, bow and flanks before the stern
  const rim = [...cells].filter(k => KI(k) >= 0 && edge(k) && free(k)).map(k => ({k, w:-KJ(k)*.5 + KI(k) + rand(0,2.5)})).sort((a,b) => b.w - a.w);
  let ng = Math.max(1, Math.min(maxGuns, Math.round(cells.size*pg)));
  for (const {k} of rim){ if (ng <= 0) break; if (!free(k)) continue; set(k, pickWeapon(stage)); ng -= KI(k) ? 2 : 1; }
  // armour plates the rest of the rim, mostly toward the bow
  for (const k of cells) if (KI(k) >= 0 && edge(k) && free(k) && Math.random() < pa*(KJ(k) < 0 ? 1.4 : .8)) set(k, 'armor');
  if (![...d.values()].some(t => ewOf(t))) d.set(K(0,-1), pickWeapon(stage));
  // later stages fit enemies with the player's systems: shields, generators (buried inside) and carrier bays (on the rim)
  if (d.size >= 8){
    const nbs = (k: Key) => NB.filter(o => d.has(k+o)).length;
    const conv = (t: EnemyCell, count: number, inner: boolean) => {
      for (let c=0; c<count; c++){
        const pool = [...d.keys()].filter(k => (d.get(k)==='hull' || d.get(k)==='armor') && (inner ? nbs(k)===4 : nbs(k) <= 2));
        if (!pool.length) return;
        const k = pool[(Math.random()*pool.length)|0], mk = K(-KI(k), KJ(k)); d.set(k,t);
        if (d.get(mk)==='hull' || d.get(mk)==='armor') d.set(mk,t);
      }
    };
    // capped, so a huge hull is not a wall of shields or a gun-speeding reactor farm
    if (stage >= 3 && (boss || Math.random() < .6)) conv('shield', Math.min(2, Math.floor(d.size/30) + (boss ? 1 : 0)) || 1, false);
    if (stage >= 4) conv('gen', Math.min(3, Math.floor(d.size/35) + (boss ? 1 : 0)), true);
    if ((boss && stage >= 5) || (d.size >= 40 && stage >= 6 && Math.random() < .25)) conv('bay', boss ? 2 : 1, false);
    if (stage >= 5) conv('pd', Math.min(5, Math.floor(d.size/45) + (boss ? 1 : 0)), false);
  }
  // a few heavy guns read better than a wall of small ones: extra weapons become armor, mirror twins together
  let guns = [...d.keys()].filter(k => ewOf(d.get(k)!));
  while (guns.length > Math.max(1, maxGuns)){
    const k = guns[(Math.random()*guns.length)|0], mk = K(-KI(k), KJ(k));
    d.set(k,'armor'); if (d.has(mk) && ewOf(d.get(mk)!) && guns.length > maxGuns + 1) d.set(mk,'armor');
    guns = guns.filter(g => ewOf(d.get(g)!));
  }
  return d;
}
/** Facings for an enemy design's guns: of the eight turret facings with a clear line out of the hull, the one nearest
 *  "outward and a little forward" from the core. */
export function gunDirs(d: Map<Key, Cell>){
  const dirs = new Map<Key, Facing>();
  for (const [k,t] of d){
    if (!ewOf(t)) continue;
    const i = KI(k), j = KJ(k), out = Math.atan2(j - 2, i);
    let best = 0, bd = 9, clearSeen = false;
    for (let o = 0; o < 8; o++){
      const a = FA[o], dx = Math.cos(a), dy = Math.sin(a);
      let clear = true;
      for (let s = .7; s < 40 && clear; s += .45){ const ci = Math.round(i + dx*s), cj = Math.round(j + dy*s); if ((ci!==i || cj!==j) && d.has(K(ci,cj))) clear = false; }
      const off = Math.abs(angDiff(a, out));
      if ((clear && !clearSeen) || (clear===clearSeen && off < bd)){ best = o; bd = off; clearSeen ||= clear; }
    }
    dirs.set(k, best as Facing);
  }
  return dirs;
}
/** World position of a block on a ship. */
export function wpos(s: Ship, b: {i: number; j: number}): [number, number] { const lx=b.i*BS, ly=b.j*BS; return [s.x + lx*s.c - ly*s.sn, s.y + lx*s.sn + ly*s.c]; }
/** The ship's block nearest (x,y) within r, or -1. */
export function hitShip(s: Ship, x: number, y: number, r: number): Key {
  const dx = x-s.x, dy = y-s.y, rr = s.r + r;
  if (dx*dx + dy*dy > rr*rr) return -1;
  const lx = (dx*s.c + dy*s.sn)/BS, ly = (-dx*s.sn + dy*s.c)/BS;
  const rad = r/BS + .5, r2 = rad*rad;
  let best = -1, bd = 1e9;
  for (let i = Math.ceil(lx-rad); i <= Math.floor(lx+rad); i++)
    for (let j = Math.ceil(ly-rad); j <= Math.floor(ly+rad); j++){
      const k = K(i,j); if (!s.blocks.has(k)) continue;
      const d = (i-lx)*(i-lx) + (j-ly)*(j-ly);
      if (d < r2 && d < bd){ bd = d; best = k; }
    }
  return best;
}
// Own-hull check for a turret shot: walks the ray out of the ship and fails on any other block.
export function laneClear(s: Ship, b: Block, worldAng: number){
  const la = worldAng - s.a, dx = Math.cos(la), dy = Math.sin(la), maxT = s.r/BS + 1;
  for (let t=.7; t<maxT; t+=.45){
    const ci = Math.round(b.i + dx*t), cj = Math.round(b.j + dy*t);
    if ((ci!==b.i || cj!==b.j) && s.blocks.has(K(ci,cj))) return false;
  }
  return true;
}
export interface RayHit { e: Ship; k: Key; t: number }
// Enemy blocks along a ray, nearest first. With first=true only the nearest block per ship is kept.
export function rayHits(ox: number, oy: number, dx: number, dy: number, len: number, first: boolean){
  const out: RayHit[] = [];
  for (const e of G.ships){
    if (!e.alive || e.team!=='e' || (e.warp || 0) > 0) continue;
    const rx = e.x-ox, ry = e.y-oy, t = rx*dx + ry*dy;
    if (t < -e.r || t - e.r > len) continue;
    if (Math.abs(rx*dy - ry*dx) > e.r) continue;
    const seen = new Set<Key>();
    for (let q = Math.max(0, t-e.r); q <= Math.min(len, t+e.r); q += BS*.4){
      const k = hitShip(e, ox+dx*q, oy+dy*q, .1);
      if (k >= 0 && !seen.has(k)){ seen.add(k); out.push({e, k, t:q}); if (first) break; }
    }
  }
  out.sort((a,b) => a.t-b.t);
  return first ? out.slice(0,1) : out;
}
export function damage(s: Ship, k: Key, dmg: number){
  const b = s.blocks.get(k); if (!b || !s.alive || (s.warp || 0) > 0) return;
  if (b.t==='armor') dmg *= 1 - ARMOR_DR;
  s.life -= Math.min(Math.max(0, b.hp), dmg); b.hp -= dmg; b.hit = G.time;
  if (b.hp <= 0) destroyBlock(s,k,b);
  if (s.alive && s.life <= 0) killShip(s);
}
export function destroyBlock(s: Ship, k: Key, b: Block){
  s.blocks.delete(k); debris(s,b,true);
  if (s.team==='p') G.lost.add(k);
  if (b.t==='core'){ killShip(s); return; }
  // an enemy generator goes up and takes its neighbours with it
  if (s.team==='e' && b.t==='gen'){
    const [wx,wy] = wpos(s,b); boomAt(wx, wy, 18*G.SC, .45); sfx('boom', 1.2);
    for (const [kk,bb] of [...s.blocks]) if (s.alive && s.blocks.has(kk) && Math.hypot(bb.i-b.i, bb.j-b.j) <= 1.6) damage(s, kk, 40*s.hpMul);
    if (!s.alive) return;
  }
  const seen = new Set([CORE]), q = [CORE];
  while (q.length){ const c = q.pop()!; for (const d of NB){ const n = c+d; if (s.blocks.has(n) && !seen.has(n)){ seen.add(n); q.push(n); } } }
  for (const [kk,bb] of s.blocks) if (!seen.has(kk)){ s.blocks.delete(kk); debris(s,bb,false); }
  recalc(s);
}
export function killShip(s: Ship){
  s.alive = false;
  for (const b of s.blocks.values()) debris(s,b,false,1.6);
  s.blocks.clear();
  // the core goes up last: a white-hot blast at the heart of the ship, with secondary blasts across the hull
  const SC = G.SC, big = s.team!=='a';
  boomAt(s.x, s.y, (big ? 12 + s.r*.3 : 6)*SC, big ? .55 : .3);
  if (big) for (let n=0; n<Math.min(6, 1 + s.r/BS/2); n++){ const a = rand(0, Math.PI*2), d = rand(.2, .8)*s.r; boomAt(s.x + Math.cos(a)*d, s.y + Math.sin(a)*d, rand(6, 11)*SC, rand(.25, .45)); }
  sparks(s.x, s.y, 0, big ? 22 : 8, (big ? 380 : 200)*SC, s.team==='e' ? ['#ffffff','#ffd0a0','#ff8a5a'] : ['#ffffff','#a8ecff','#5fd8ff']);
  if (big && !REDUCE) G.shake = Math.min(6, G.shake + (s.team==='p' || s.boss ? 5 : 2.5));
  G.fx.push({k:'ring', x:s.x, y:s.y, r:s.r*1.8 + 20*G.SC, life:.7, max:.7, col:s.team==='p' ? '#ffffff' : '#ff9a7a'});
  if (s.team==='e'){
    sfx(s.boss ? 'big' : 'boom', Math.min(1.5, .4 + s.r/60));
    G.credits += s.value; G.earned += s.value; if (G.stats) G.stats.kills++;
    G.fx.push({k:'txt', x:s.x, y:s.y, vy:-30*G.SC, text:'+'+s.value, life:1.4, max:1.4});
  } else if (s.team==='p'){ G.deadT = 1.6; sfx('die'); }
  else sfx('boom', .6);
}
export function debris(s: Ship, b: Block, burst: boolean, kick=1){
  if (G.fx.length > 1800) return;
  const [x,y] = wpos(s,b), v = 70*G.SC*kick;
  G.fx.push({k:'deb', x, y, vx:s.vx*.5 + rand(-v,v), vy:s.vy*.5 + rand(-v,v), a:s.a, va:rand(-4,4), life:rand(1,2.2), max:2.2, col:COL[s.team][b.t] || '#888888'});
  if (burst) for (let n=0; n<4; n++) G.fx.push({k:'spk', x, y, vx:rand(-1,1)*160*G.SC, vy:rand(-1,1)*160*G.SC, life:rand(.15,.4), max:.4, col:'#ffffff'});
}
export function boomAt(x: number, y: number, r: number, life: number){ G.fx.push({k:'boom', x, y, r, life, max:life}); }
export function sparks(x: number, y: number, ang: number, n: number, spd: number, cols: string[]){
  for (let q=0; q<n; q++){
    const a = ang + rand(-1.3,1.3), v = rand(.3,1)*spd;
    G.fx.push({k:'spk', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:rand(.25,.6), max:.6, col:cols[q % cols.length]});
  }
}
// Cannon shell hit: splash onto neighbouring blocks, knockback, fireball, flying sparks, smoke, screen shake.
// The light KM-3 shell gets a smaller blast and a gentler shake than the Goliath shell or a torpedo.
export function impact(b: {x: number; y: number; vx: number; vy: number; dmg: number}, e: Ship, k: Key, light=false){
  const SC = G.SC, ang = Math.atan2(b.vy,b.vx), x = b.x, y = b.y;
  if (e.alive) for (const d of NB) if (e.blocks.has(k+d)) damage(e, k+d, b.dmg*.4);
  const kick = 55*SC/Math.sqrt(e.blocks.size + 1);
  e.vx += Math.cos(ang)*kick; e.vy += Math.sin(ang)*kick;
  boomAt(x, y, (light ? 10 : 13)*SC, light ? .22 : .24);
  sparks(x, y, ang+Math.PI, light ? 10 : 12, 300*SC, ['#ffffff','#ffd27a','#ff8a4a']);
  for (let n=0; n<3; n++) G.fx.push({k:'smoke', x:x + rand(-4,4)*SC, y:y + rand(-4,4)*SC, vx:rand(-12,12)*SC + e.vx*.4, vy:rand(-12,12)*SC + e.vy*.4, r:(light ? rand(4,7.5) : rand(5,9))*SC, life:rand(.6,1.1), max:1.1});
  if (!REDUCE) G.shake = light ? Math.min(2.5, G.shake + .7) : Math.min(4, G.shake + 1.6);
}
