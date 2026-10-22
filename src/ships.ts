import { Quaternion, Vector3 } from 'three';
import { sfx } from './audio';
import { COL, ESH, ET, LV, PARTS, T, def, ewOf, isCraft, pickWeapon } from './catalog';
import { BS, CORE, K, KI, KJ, KL, NB, cellVec, rand } from './grid';
import { laneFwd, partComplete, physics } from './physics';
import { metaLv } from './runs';
import { G } from './state';
import type { Block, Cell, EnemyCell, Facing, Key, Physics, Ship, Team } from './types';
import { REDUCE } from './view';

const NO_PHYSICS: Physics = {mass:0, inertia:0, torque:0, coreT:0, F:{px:0, nx:0, py:0, ny:0, pz:0, nz:0}, engines:[]};
const tmpQ = new Quaternion(), tmpV = new Vector3();

// ---------- ships ----------
export function makeShip(design: Map<Key, Cell>, team: Team, p: Vector3, hpMul=1, dirs: Map<Key, Facing> | null = null): Ship {
  const s: Ship = {team, p:p.clone(), v:new Vector3(), q:new Quaternion(), w:new Vector3(), blocks:new Map(), alive:true, hpMul, r:0, ver:0,
    guns:[], pds:[], rails:[], lasers:[], shields:[], bays:[], epd:[], teslas:[],
    ph:NO_PHYSICS, en:0, enMax:0, enRegen:0,
    boss:false, elite:false, flag:false, station:false, fodder:false, craft:false, n0:design.size, phaseN:1, sc:G.SC,
    fireMul:1, ft:0, phase:0, spin:1, orb:0, orbSpd:0, pref:0, vmax:0, turn:0, value:0, orbAxis:new Vector3(0,1,0), tgt:null, sights:null,
    kind:null, bay:null, sortie:0, cd:0, pick:0};
  for (const [k,t] of design){
    const hp = (team==='e' ? ET[t as EnemyCell].hp : def(t)!.hp!*LV(t)*(team==='p' && t==='core' ? 1 + .25*metaLv('core') : 1)) * hpMul;
    const b: Block = {t, i:KI(k), j:KJ(k), l:KL(k), o:dirs ? dirs.get(k)||0 : 0, hp, max:hp, cd:Math.random()*.4, hit:-1};
    s.blocks.set(k, b);
  }
  recalc(s); return s;
}
export function recalc(s: Ship){
  let r = 0; s.guns = []; s.pds = []; s.rails = []; s.lasers = []; s.shields = []; s.bays = []; s.epd = []; s.teslas = [];
  for (const b of s.blocks.values()) r = Math.max(r, Math.hypot(b.i,b.j,b.l)*BS + BS*.9);
  s.r = r; s.ver++;
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
    if (d.gun && !(PARTS[b.t] && !partComplete(typeAt, b.i, b.j, b.l, b.t, b.o))) s.guns.push(b);
    if (d.pd) s.pds.push(b);
    if (d.tesla) s.teslas.push(b);
    if (b.t==='shield') s.shields.push(b);
    if (PARTS[b.t] && !d.gun && partComplete(typeAt, b.i, b.j, b.l, b.t, b.o)){
      if (isCraft(b.t)){ s.bays.push(b); if (b.bt == null) b.bt = 1.5; continue; }
      b.lane = laneFwd(typeAt, b.i, b.j, b.l, b.o);
      (b.t==='rail' ? s.rails : s.lasers).push(b);
    }
  }
  // energy: the core gives a little; generators add recharge, batteries add storage
  let cap = 40, regen = 6;
  for (const b of s.blocks.values()){ if (b.t==='gen') regen += T.gen.en!.regen!*LV('gen'); if (b.t==='battery') cap += T.battery.en!.cap!*LV('battery'); }
  // a fresh ship starts with full batteries; losing a battery later only trims what is stored
  const fresh = s.enMax === 0;
  s.enMax = cap; s.enRegen = regen; s.en = fresh ? cap : Math.min(s.en, cap);
  // each shield block keeps its own bubble state
  for (const b of s.shields) if (!b.bub){ const max = T.shield.sh!.hp*LV('shield'); b.bub = {hp:max, max, down:0, last:-9, flash:-9}; }
}
/** Cells that are on the outside of a hull: at least two open faces. */
const openFaces = (d: Map<Key, unknown>, k: Key) => NB.filter(o => !d.has(k+o)).length;
// Enemy hulls grow as a flattened blob around the core, mirrored left/right: wider than they are tall.
export function genDesign(n: number, boss: boolean, stage: number, maxGuns=99){
  const d = new Map<Key, EnemyCell>([[CORE,'core']]), keys = [CORE];
  const pa = Math.min(.3, .08 + .025*stage), pg = boss ? .12 : .15;
  const H = Math.max(1, Math.round(Math.cbrt(n)*.5));
  // vertical steps are rarer than horizontal ones
  const steps = [NB[0], NB[1], NB[2], NB[3], NB[0], NB[1], NB[2], NB[3], NB[4], NB[5]];
  let tries = 0;
  while (d.size < n && tries++ < n*30){
    const base = keys[(Math.random()*keys.length)|0];
    const nk = base + steps[(Math.random()*steps.length)|0];
    if (d.has(nk)) continue;
    const i = KI(nk), j = KJ(nk), l = KL(nk);
    if (Math.abs(i) > 40 || Math.abs(j) > 40 || Math.abs(l) > H) continue;
    const r = Math.random(), t: EnemyCell = r < pg ? pickWeapon(stage) : r < pg+pa ? 'armor' : 'hull';
    d.set(nk,t); keys.push(nk);
    if (i !== 0){ const mk = K(-i,j,l); if (!d.has(mk)){ d.set(mk,t); keys.push(mk); } }
  }
  if (![...d.values()].some(t => ewOf(t))) d.set(keys[1] ?? K(0,-1), pickWeapon(stage));
  // later stages fit enemies with the player's systems: shields, generators (buried inside) and carrier bays (on the rim)
  if (d.size >= 8){
    const conv = (t: EnemyCell, count: number, inner: boolean) => {
      for (let c=0; c<count; c++){
        const pool = [...d.keys()].filter(k => (d.get(k)==='hull' || d.get(k)==='armor') && (inner ? openFaces(d,k)===0 : openFaces(d,k) >= 2));
        if (!pool.length) return;
        const k = pool[(Math.random()*pool.length)|0], mk = K(-KI(k), KJ(k), KL(k)); d.set(k,t);
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
    const k = guns[(Math.random()*guns.length)|0], mk = K(-KI(k), KJ(k), KL(k));
    d.set(k,'armor'); if (d.has(mk) && ewOf(d.get(mk)!) && guns.length > maxGuns + 1) d.set(mk,'armor');
    guns = guns.filter(g => ewOf(d.get(g)!));
  }
  return d;
}
/** World position of a block on a ship. */
export function wpos(s: Ship, b: {i: number; j: number; l: number}, out = new Vector3()){
  return cellVec(b.i, b.j, b.l, out).applyQuaternion(s.q).add(s.p);
}
/** A world direction in the ship's own axes. */
export const toLocal = (s: Ship, dir: Vector3, out = new Vector3()) => out.copy(dir).applyQuaternion(tmpQ.copy(s.q).invert());
/** A ship-local direction in world axes. */
export const toWorld = (s: Ship, dir: Vector3, out = new Vector3()) => out.copy(dir).applyQuaternion(s.q);
/** The ship's block nearest a world point within r, or -1. */
export function hitShip(s: Ship, pt: Vector3, r: number): Key {
  const dx = pt.x-s.p.x, dy = pt.y-s.p.y, dz = pt.z-s.p.z, rr = s.r + r;
  if (dx*dx + dy*dy + dz*dz > rr*rr) return -1;
  const loc = toLocal(s, tmpV.set(dx,dy,dz)).divideScalar(BS);
  const li = loc.x, lj = loc.z, ll = loc.y, rad = r/BS + .5, r2 = rad*rad;
  let best = -1, bd = 1e9;
  for (let i = Math.ceil(li-rad); i <= Math.floor(li+rad); i++)
    for (let j = Math.ceil(lj-rad); j <= Math.floor(lj+rad); j++)
      for (let l = Math.ceil(ll-rad); l <= Math.floor(ll+rad); l++){
        const k = K(i,j,l); if (!s.blocks.has(k)) continue;
        const d = (i-li)**2 + (j-lj)**2 + (l-ll)**2;
        if (d < r2 && d < bd){ bd = d; best = k; }
      }
  return best;
}
// Own-hull check for a turret shot: walks the ray out of the ship and fails on any other block.
export function laneClear(s: Ship, b: Block, worldDir: Vector3){
  const d = toLocal(s, worldDir), maxT = s.r/BS + 1;
  for (let t=.7; t<maxT; t+=.45){
    const ci = Math.round(b.i + d.x*t), cj = Math.round(b.j + d.z*t), cl = Math.round(b.l + d.y*t);
    if ((ci!==b.i || cj!==b.j || cl!==b.l) && s.blocks.has(K(ci,cj,cl))) return false;
  }
  return true;
}
export interface RayHit { e: Ship; k: Key; t: number }
// Enemy blocks along a ray, nearest first. With first=true only the nearest block per ship is kept.
export function rayHits(o: Vector3, dir: Vector3, len: number, first: boolean){
  const out: RayHit[] = [], pt = new Vector3();
  for (const e of G.ships){
    if (!e.alive || e.team!=='e') continue;
    tmpV.subVectors(e.p, o);
    const t = tmpV.dot(dir);
    if (t < -e.r || t - e.r > len) continue;
    if (tmpV.addScaledVector(dir, -t).lengthSq() > e.r*e.r) continue;
    const seen = new Set<Key>();
    for (let q = Math.max(0, t-e.r); q <= Math.min(len, t+e.r); q += BS*.4){
      const k = hitShip(e, pt.copy(o).addScaledVector(dir, q), .1);
      if (k >= 0 && !seen.has(k)){ seen.add(k); out.push({e, k, t:q}); if (first) break; }
    }
  }
  out.sort((a,b) => a.t-b.t);
  return first ? out.slice(0,1) : out;
}
export function damage(s: Ship, k: Key, dmg: number){
  const b = s.blocks.get(k); if (!b) return;
  b.hp -= dmg; b.hit = G.time;
  if (b.hp <= 0) destroyBlock(s,k,b);
}
export function destroyBlock(s: Ship, k: Key, b: Block){
  s.blocks.delete(k); debris(s,b,true);
  if (s.team==='p') G.lost.add(k);
  if (b.t==='core'){ killShip(s); return; }
  // an enemy generator goes up and takes its neighbours with it
  if (s.team==='e' && b.t==='gen'){
    boomAt(wpos(s,b), 18*G.SC, .45); sfx('boom', 1.2);
    for (const [kk,bb] of [...s.blocks]) if (s.alive && s.blocks.has(kk) && Math.hypot(bb.i-b.i, bb.j-b.j, bb.l-b.l) <= 1.6) damage(s, kk, 40*s.hpMul);
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
  s.blocks.clear(); s.ver++;
  G.fx.push({k:'ring', p:s.p.clone(), r:s.r*1.8 + 20*G.SC, life:.7, max:.7, col:s.team==='p' ? '#ffffff' : '#ff9a7a'});
  if (s.team==='e'){
    sfx(s.boss ? 'big' : 'boom', Math.min(1.5, .4 + s.r/60));
    G.credits += s.value; G.earned += s.value; if (G.stats) G.stats.kills++;
    G.fx.push({k:'txt', p:s.p.clone(), vy:30*G.SC, text:'+'+s.value, life:1.4, max:1.4});
  } else if (s.team==='p'){ G.deadT = 1.6; sfx('die'); }
  else sfx('boom', .6);
}
/** A random direction, uniformly over the sphere. */
export const randDir = (out = new Vector3()) => { const z = rand(-1,1), a = rand(0, Math.PI*2), r = Math.sqrt(1 - z*z); return out.set(r*Math.cos(a), z, r*Math.sin(a)); };
export function debris(s: Ship, b: Block, burst: boolean, kick=1){
  if (G.fx.length > 1800) return;
  const p = wpos(s,b), v = 70*G.SC*kick;
  G.fx.push({k:'deb', p, v:s.v.clone().multiplyScalar(.5).add(randDir().multiplyScalar(rand(0,v))), spin:randDir().multiplyScalar(rand(1,4)), life:rand(1,2.2), max:2.2, col:COL[s.team][b.t] || '#888888'});
  if (burst) for (let n=0; n<4; n++) G.fx.push({k:'spk', p:p.clone(), v:randDir().multiplyScalar(rand(40,160)*G.SC), life:rand(.15,.4), max:.4, col:'#ffffff'});
}
export function boomAt(p: Vector3, r: number, life: number){ G.fx.push({k:'boom', p:p.clone(), r, life, max:life}); }
/** Sparks thrown roughly along a direction (or every way when dir is null). */
export function sparks(p: Vector3, dir: Vector3 | null, n: number, spd: number, cols: string[]){
  for (let q=0; q<n; q++){
    const d = randDir(); if (dir) d.multiplyScalar(.8).add(dir).normalize();
    G.fx.push({k:'spk', p:p.clone(), v:d.multiplyScalar(rand(.3,1)*spd), life:rand(.25,.6), max:.6, col:cols[q % cols.length]});
  }
}
// Cannon shell hit: splash onto neighbouring blocks, knockback, fireball, flying sparks, smoke, screen shake.
export function impact(b: {p: Vector3; v: Vector3; dmg: number}, e: Ship, k: Key){
  const SC = G.SC, dir = b.v.clone().normalize();
  if (e.alive) for (const d of NB) if (e.blocks.has(k+d)) damage(e, k+d, b.dmg*.4);
  e.v.addScaledVector(dir, 55*SC/Math.sqrt(e.blocks.size + 1));
  boomAt(b.p, 13*SC, .24);
  sparks(b.p, dir.clone().negate(), 12, 300*SC, ['#ffffff','#ffd27a','#ff8a4a']);
  for (let n=0; n<3; n++) G.fx.push({k:'smoke', p:b.p.clone().add(randDir().multiplyScalar(4*SC)), v:randDir().multiplyScalar(12*SC).addScaledVector(e.v, .4), r:rand(5,9)*SC, life:rand(.6,1.1), max:1.1});
  if (!REDUCE) G.shake = Math.min(4, G.shake + 1.6);
}
