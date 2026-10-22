import { Vector3 } from 'three';
import { sfx } from './audio';
import { EB_SPD, eBullet, jitter, leadDir, pBullet } from './bullets';
import { CRAFT, LV, T, ewOf, isCraft } from './catalog';
import { craftCap, eDmg, faceQ, inArena } from './fights';
import { BS, DIRV, K, TAU, rand } from './grid';
import { boomAt, damage, makeShip, randDir, rayHits, sparks, toWorld, wpos } from './ships';
import { G } from './state';
import type { Block, Bullet, Cell, CraftKind, Key, Ship } from './types';
import { REDUCE } from './view';

const tv = new Vector3(), tv2 = new Vector3();

// ---------- hangar craft ----------
/** A hangar craft's hull as a design map. */
const craftDesign = (kind: CraftKind) => new Map<Key, Cell>(CRAFT[kind].design.map(([i,j,t]) => [K(i,j), t as Cell]));
/** Where a craft circles its target: a point on a tilted ring around it. */
function orbitPoint(A: Ship, o: Ship, R: number){
  const u = tv.set(1,0,0).cross(A.orbAxis); if (u.lengthSq() < 1e-4) u.set(0,0,1).cross(A.orbAxis);
  u.normalize(); const v = tv2.crossVectors(A.orbAxis, u);
  return o.p.clone().addScaledVector(u, Math.cos(A.orb)*R).addScaledVector(v, Math.sin(A.orb)*R);
}
/** Fly a craft toward a point, nose along its velocity. */
function flyTo(A: Ship, at: Vector3, spd: number, agi: number, turn: number, dt: number, drift = tv.set(0,0,0)){
  const to = at.clone().sub(A.p), el = to.length() || 1, v = Math.min(spd, el*2);
  A.v.lerp(to.multiplyScalar(v/el).add(drift), Math.min(1, dt*agi));
  A.p.addScaledVector(A.v, dt); inArena(A.p);
  if (A.v.lengthSq() > 4) A.q.rotateTowards(faceQ(A.p, A.p.clone().add(A.v)), turn*dt);
}
// Enemy carriers launch the same fighters and bombers as the player's bays. They fight until shot down.
export function launchECraft(e: Ship, b: {i: number; j: number; l: number}){
  const kind: CraftKind = G.stage >= 4 && Math.random() < .35 ? 'bbay' : 'fbay', C = CRAFT[kind], w = wpos(e,b);
  const A = makeShip(craftDesign(kind), 'e', w, C.hp*(1 + .15*(G.stage-1)));
  A.craft = true; A.fodder = true; A.kind = kind; A.sc = G.SC; A.cd = 1.5; A.pick = 0; A.orb = rand(0,TAU); A.orbAxis = randDir();
  A.value = kind==='bbay' ? 2 : 1; A.q.copy(e.q);
  A.v.copy(e.v).add(w.clone().sub(e.p).normalize().multiplyScalar(C.spd*G.SC*.5));
  for (const x of A.blocks.values()) if (x.t==='engine') x.firing = true;
  G.ships.push(A); sfx('launch'); return A;
}
// Enemy fighters chase the player's craft when one is close, otherwise the ship; bombers always pass over the ship's hull.
export function updateECraft(A: Ship, dt: number, allies: Ship[]){
  const p = G.player!, C = CRAFT[A.kind!], SC = G.SC;
  A.cd -= dt;
  if (!A.tgt || !A.tgt.alive || (A.pick -= dt) <= 0){
    A.pick = 1.5; A.tgt = p; let bd = p.p.distanceToSquared(A.p);
    if (A.kind==='fbay') for (const o of allies){ const d = o.p.distanceToSquared(A.p); if (o.alive && d < bd){ bd = d; A.tgt = o; } }
  }
  const o = A.tgt!;
  A.orb += C.orbSpd*dt;
  if (p.alive && A.cd <= 0 && o.p.distanceTo(A.p) < o.r + C.range*SC){
    const bomb = A.kind==='bbay', dir = jitter(o.p.clone().sub(A.p).normalize(), C.gun.spread);
    A.cd = C.gun.cd*(bomb ? 1.6 : 2.4);
    const b = eBullet(A.p, dir, C.gun.spd/110*.45, bomb ? 'eflak' : 'egat', (bomb ? 18 : 4)*eDmg(), bomb ? 1.2 : .7);
    if (b && bomb){ b.fuse = CRAFT.bbay.gun.fuse*SC; b.blast = CRAFT.bbay.gun.blast*SC; b.life = CRAFT.bbay.gun.life; }
  }
  flyTo(A, orbitPoint(A, o, o.r*C.over + C.orbit*SC), C.spd*SC*.85, C.agi, C.turn, dt);
}
export function launchCraft(p: Ship, b: Block){
  if (!isCraft(b.t)) return;
  const C = CRAFT[b.t], w = wpos(p,b), dir = toWorld(p, DIRV[b.o]);
  const A = makeShip(craftDesign(b.t), 'a', w, C.hp*LV(b.t));
  faceQ(A.p, A.p.clone().add(dir), A.q); A.orbAxis = randDir();
  A.v.copy(p.v).addScaledVector(dir, C.spd*G.SC*.6);
  A.kind = b.t; A.bay = b; A.sortie = C.sortie; A.cd = .5; A.pick = 0; A.orb = rand(0,TAU);
  for (const x of A.blocks.values()) if (x.t==='engine') x.firing = true;
  b.ally = A; G.ships.push(A); sfx('launch');
}
// Out on sortie the craft circles the nearest enemy and shoots it (or escorts the player); when the sortie ends it flies home and docks.
export function updateCraft(A: Ship, dt: number, enemies: Ship[]){
  const p = G.player!, C = CRAFT[A.kind!], SC = G.SC, bay = A.bay!;
  A.sortie -= dt; A.cd -= dt;
  // bay gone or ship lost: nowhere to land, so keep fighting
  if (A.sortie <= 0 && !(p.alive && p.bays.includes(bay))) A.sortie = 10;
  const home = A.sortie <= 0;
  if (home){
    const at = wpos(p, bay);
    if (at.distanceTo(A.p) < BS*1.5){ A.alive = false; bay.ally = null; bay.bt = C.rearm; sfx('dock'); return; }
    // heading home it matches the player's drift so it can catch the bay
    flyTo(A, at, C.spd*SC*1.6, C.agi*2, C.turn, dt, p.v.clone());
    return;
  }
  if (!A.tgt || !A.tgt.alive || (A.pick -= dt) <= 0){
    A.pick = 1.5; A.tgt = null; let bd = 1e18;
    for (const e of enemies){ const d = e.p.distanceToSquared(A.p); if (e.alive && d < bd){ bd = d; A.tgt = e; } }
  }
  const o: Ship = A.tgt || p, R = A.tgt ? o.r*C.over + C.orbit*SC : p.r + 40*SC;
  A.orb += C.orbSpd*dt;
  if (A.tgt){
    const e = A.tgt;
    if (A.cd <= 0 && e.p.distanceTo(A.p) < e.r + C.range*SC){
      A.cd = C.gun.cd; pBullet(A.p, jitter(e.p.clone().sub(A.p).normalize(), C.gun.spread), C.gun, e, LV(A.kind!)); sfx(C.sfx, .5);
    }
  }
  flyTo(A, orbitPoint(A, o, R), C.spd*SC, C.agi, C.turn, dt);
}
export function fireRail(p: Ship, w: Vector3, dir: Vector3){
  const R = T.rail.rail!, SC = G.SC, o = w.clone().addScaledVector(dir, BS*.5), len = R.range*SC;
  let pool = R.pool*LV('rail'), end = len;
  for (const h of rayHits(o, dir, len, false)){
    if (!h.e.alive) continue;
    const b = h.e.blocks.get(h.k); if (!b) continue;
    const d = Math.min(pool, b.hp + .01);
    damage(h.e, h.k, d); pool -= d;
    const at = o.clone().addScaledVector(dir, h.t);
    sparks(at, dir.clone().negate(), 3, 220*SC, ['#ffffff','#efe6ff']);
    if (pool <= 0){ end = h.t; boomAt(at, 10*SC, .2); break; }
  }
  G.beams.push({a:o, b:o.clone().addScaledVector(dir, end), life:.35, max:.35, kind:'rail'});
  boomAt(o, 6*SC, .1);
  p.v.addScaledVector(dir, -70*SC/Math.sqrt(p.ph.mass));
  if (!REDUCE) G.shake = Math.min(4, G.shake + 2.4);
}
/** Evenly spread directions over a sphere (a Fibonacci lattice), turned by `twist`. */
function burstDirs(n: number, twist: number){
  const out: Vector3[] = [];
  for (let q=0; q<n; q++){ const y = 1 - 2*(q+.5)/n, r = Math.sqrt(1 - y*y), a = q*2.39996 + twist; out.push(new Vector3(r*Math.cos(a), y*.6, r*Math.sin(a)).normalize()); }
  return out;
}
export function enemyFire(e: Ship, dt: number){
  const p = G.player!;
  if (e.boss){
    // flagships fight in three phases as they lose blocks: spiral, then fighters, then ring bursts
    if (e.flag){
      const f = e.blocks.size/e.n0, ph = f > .66 ? 1 : f > .33 ? 2 : 3;
      const nm = e.station ? 'starbase' : 'flagship';
      if (ph > e.phaseN){ e.phaseN = ph; G.banner = {text:`Phase ${ph}`, sub: ph===2 ? `The ${nm} scrambles its hangars` : `The ${nm} fires ring bursts`, red:true, t:2.4}; sfx('pop'); }
      if (ph >= 2 && (e.flT = (e.flT ?? 1) - dt) <= 0){
        e.flT = 10;
        for (let q=0; q<2; q++) if (G.ships.filter(x => x.alive && x.craft).length < craftCap() + 2) launchECraft(e, {i:Math.round(rand(-.3,.3)*e.r/BS), j:Math.round(rand(-.3,.3)*e.r/BS), l:0});
      }
      if (ph >= 3 && (e.rbT = (e.rbT ?? 1.5) - dt) <= 0){
        e.rbT = 4.5;
        for (const d of burstDirs(14, e.phase)) eBullet(e.p, d, .55, 'ring', 8*eDmg());
      }
    }
    // capital ships also sweep a slow spiral of orbs, tilted up and down as it turns
    e.ft -= dt;
    if (e.ft <= 0){
      e.ft = e.flag ? 1 : 1.1;
      const arms = e.flag ? Math.min(2, e.phaseN) : 1 + (G.stage >= 6 ? 1 : 0);
      for (let q=0; q<arms; q++){ const a = e.phase + q*TAU/arms; eBullet(e.p, new Vector3(Math.cos(a), Math.sin(e.phase*.7)*.35, Math.sin(a)).normalize(), .7, 'ring', 8*eDmg()); }
      e.phase += .3*e.spin;
    }
  }
  // stagger the first shots so a fresh wave does not fire all at once
  if (!e.armed){ e.armed = true; for (const g of e.guns){ g.cd = rand(.6, ewOf(g.t)!.cd); g.shots = 0; } }
  e.sights = null;
  const tgt = e.boss ? p : e.tgt || p;
  for (const g of e.guns){
    const w = ewOf(g.t)!, at = wpos(e,g), sp = w.spd*e.sc;
    g.cd -= dt;
    if (w.aim && g.cd < w.aim) (e.sights ||= []).push([at, leadDir(at, sp, .6, tgt)]);
    if (g.cd > 0) continue;
    if (w.range && tgt.p.distanceTo(at) - tgt.r > w.range*e.sc){ g.cd = .3; g.shots = 0; continue; }
    if (w.burst && (g.shots = (g.shots || 0) + 1) < w.burst) g.cd = w.gap!;
    else { g.shots = 0; g.cd = w.cd*rand(.85,1.15); }
    const dir = jitter(leadDir(at, sp, .95, tgt), (w.spread || 0)/2);
    const b = eBullet(at, dir, w.spd/110*e.sc/G.SC, w.kind, w.dmg*(e.fodder ? .5 : 1)*eDmg(), w.r*e.sc/G.SC);
    if (!b) continue;
    if (w.range && !w.fuse && w.kind!=='emiss'){ b.life = b.life0 = w.range/(w.spd*EB_SPD); b.fall = true; }
    if (w.kind==='emiss'){ b.tgt = tgt; b.life = 8; }
    if (w.fuse){ b.fuse = w.fuse*e.sc; b.blast = w.blast!*e.sc; b.life = w.life!; }
  }
}
// Enemy warhead or flak burst on a ship: every block within rad takes damage falling off from the centre.
export function blastShip(s: Ship, at: Vector3, rad: number, dmg: number){
  const bp = new Vector3();
  for (const [k,bb] of [...s.blocks]){
    if (!s.alive || !s.blocks.has(k)) continue;
    const d = wpos(s, bb, bp).distanceTo(at);
    if (d < rad) damage(s, k, dmg*(1 - .6*d/rad));
  }
}
export function eBurst(b: Bullet){
  const blast = b.blast || 0;
  b.dead = true; boomAt(b.p, blast*.55, .25); sfx('boom', .4);
  sparks(b.p, null, 6, 140*G.SC, ['#ffb03a','#ffe08a','#ffffff']);
  for (const s of G.ships) if (s.alive && s.team!=='e' && s.p.distanceTo(b.p) < s.r + blast) blastShip(s, b.p, blast, b.dmg);
}
export function updateFx(dt: number){
  for (const f of G.fx){
    f.life -= dt;
    if (f.k==='deb' || f.k==='spk' || f.k==='smoke'){ f.p.addScaledVector(f.v, dt); f.v.multiplyScalar(.985); }
    else if (f.k==='txt') f.p.y += f.vy*dt;
  }
  G.fx = G.fx.filter(f => f.life > 0);
  G.shake *= Math.pow(.004, dt);
  for (const b of G.beams) b.life -= dt;
  G.beams = G.beams.filter(b => b.life > 0);
  if (G.banner){ G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
}
