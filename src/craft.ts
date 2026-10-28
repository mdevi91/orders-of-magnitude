import { sfx } from './audio';
import { EB_SPD, eBullet, leadAngle, pBullet } from './bullets';
import { CRAFT, HM, LV, T, bayKind, cockpit, ewOf, isCraft, shRad } from './catalog';
import { eDmg, eReach } from './fights';
import { BS, FA, K, SWING, TAU, angDiff, clamp, rand } from './grid';
import { boomAt, damage, laneClear, makeShip, rayHits, sparks, wpos } from './ships';
import { G } from './state';
import { tut } from './tutorial';
import type { Block, BlockType, Bullet, Cell, CraftKind, Key, Ship } from './types';
import { locked } from './targeting';
import { REDUCE } from './view';

// ---------- hangar craft ----------
// Enemy carriers launch the same fighters and bombers as the player's bays. They fight until shot down.
/** A hangar craft's hull as a design map. */
const craftDesign = (kind: CraftKind) => new Map<Key, Cell>(CRAFT[kind].design.map(([i,j,t]) => [K(i,j), t as Cell]));
export function launchECraft(e: Ship, b: {i: number; j: number}){
  const kind: CraftKind = G.stage >= 4 && Math.random() < .35 ? 'bbay' : 'fbay', C = CRAFT[kind], [wx,wy] = wpos(e,b);
  const A = makeShip(craftDesign(kind), 'e', wx, wy, C.hp*(1 + .15*(G.stage-1)));
  A.craft = true; A.fodder = true; A.kind = kind; A.sc = G.SC; A.cd = 1.5; A.pick = 0; A.orb = rand(0,TAU);
  A.value = kind==='bbay' ? 2 : 1; A.a = e.a; A.c = Math.cos(A.a); A.sn = Math.sin(A.a);
  const ang = Math.atan2(wy-e.y, wx-e.x), v = C.spd*G.SC*.5; A.vx = e.vx + Math.cos(ang)*v; A.vy = e.vy + Math.sin(ang)*v;
  for (const x of A.blocks.values()) if (x.t==='engine') x.firing = true;
  G.ships.push(A); sfx('launch'); return A;
}
// Enemy fighters chase the player's craft when one is close, otherwise the ship; bombers always pass over the ship's hull.
export function updateECraft(A: Ship, dt: number, allies: Ship[]){
  const p = G.player!, C = CRAFT[A.kind!], SC = G.SC;
  A.cd -= dt;
  if (!A.tgt || !A.tgt.alive || (A.pick -= dt) <= 0){
    A.pick = 1.5; A.tgt = p; let bd = (p.x-A.x)**2 + (p.y-A.y)**2;
    if (A.kind==='fbay') for (const o of allies){ const d = (o.x-A.x)**2 + (o.y-A.y)**2; if (o.alive && d < bd*2.2){ bd = d/2.2; A.tgt = o; } }
  }
  const o = A.tgt!, R = o.r*C.over + C.orbit*SC;
  A.orb += C.orbSpd*dt;
  const tx = o.x + Math.cos(A.orb)*R, ty = o.y + Math.sin(A.orb)*R;
  if (p.alive && A.cd <= 0 && !(o === p && G.cloakT > G.time) && Math.hypot(o.x-A.x, o.y-A.y) < o.r + C.range*SC){
    const bomb = A.kind==='bbay', ang = Math.atan2(o.y-A.y, o.x-A.x) + (Math.random()-.5)*2*C.gun.spread;
    A.cd = C.gun.cd*(bomb ? 1.6 : 2.4);
    const b = eBullet(A.x, A.y, ang, C.gun.spd/110*.45, bomb ? 'eflak' : 'egat', (bomb ? 18 : 4)*eDmg(), bomb ? 1.2 : .7);
    if (b && bomb){ b.fuse = CRAFT.bbay.gun.fuse*SC; b.blast = CRAFT.bbay.gun.blast*SC; b.life = CRAFT.bbay.gun.life; }
  }
  const ex = tx-A.x, ey = ty-A.y, el = Math.hypot(ex,ey) || 1, v = Math.min(C.spd*SC*.85, el*2);
  A.vx += (ex/el*v - A.vx)*Math.min(1, dt*C.agi); A.vy += (ey/el*v - A.vy)*Math.min(1, dt*C.agi);
  A.x = clamp(A.x + A.vx*dt, 0, G.AW); A.y = clamp(A.y + A.vy*dt, 0, G.AH);
  if (A.vx*A.vx + A.vy*A.vy > 4) A.a += clamp(angDiff(Math.atan2(A.vx,-A.vy), A.a), -C.turn*dt, C.turn*dt);
}
export function launchCraft(p: Ship, b: Block){
  const kd = bayKind(b); if (!kd) return;
  const C = CRAFT[kd], [wx,wy] = wpos(p,b), dir = p.a + FA[b.o], v = C.spd*G.SC*.6;
  const A = makeShip(craftDesign(kd), 'a', wx, wy, C.hp*LV(kd)*(cockpit().craftHp || 1));
  A.a = dir + Math.PI/2; A.c = Math.cos(A.a); A.sn = Math.sin(A.a); A.aimA = dir;
  A.vx = p.vx + Math.cos(dir)*v; A.vy = p.vy + Math.sin(dir)*v;
  A.kind = kd; A.bay = b; A.sortie = C.sortie; A.cd = .5; A.pick = 0; A.orb = rand(0,TAU);
  for (const x of A.blocks.values()) if (x.t==='engine') x.firing = true;
  b.ally = A; G.ships.push(A); sfx('launch'); tut('craft');
}
// Out on sortie the craft circles the nearest enemy and shoots it (or escorts the player); when the sortie ends it flies home and docks.
export function updateCraft(A: Ship, dt: number, enemies: Ship[]){
  const p = G.player!, C = CRAFT[A.kind!], SC = G.SC, bay = A.bay!;
  A.sortie -= dt; A.cd -= dt;
  // bay gone or ship lost: nowhere to land, so keep fighting
  if (A.sortie <= 0 && !(p.alive && p.bays.includes(bay))) A.sortie = 10;
  let tx: number, ty: number;
  const home = A.sortie <= 0;
  if (home){
    [tx,ty] = wpos(p,bay);
    if (Math.hypot(tx-A.x, ty-A.y) < BS*1.5){ A.alive = false; bay.ally = null; bay.bt = C.rearm/(cockpit().build || 1); sfx('dock'); return; }
  } else {
    if (!A.tgt || !A.tgt.alive || (A.pick -= dt) <= 0){
      // fighters and bombers go for the lock (targeting mode) first
      A.pick = 1.5; A.tgt = locked(); let bd = A.tgt ? -1 : 1e18;
      for (const e of enemies){ const d = (e.x-A.x)**2 + (e.y-A.y)**2; if (e.alive && d < bd){ bd = d; A.tgt = e; } }
    }
    const o: Ship = A.tgt || p, R = A.tgt ? o.r*C.over + C.orbit*SC : p.r + 40*SC;
    A.orb += C.orbSpd*dt; tx = o.x + Math.cos(A.orb)*R; ty = o.y + Math.sin(A.orb)*R;
    if (A.tgt){
      const e = A.tgt, ang = Math.atan2(e.y-A.y, e.x-A.x); A.aimA = ang;
      if (A.cd <= 0 && Math.hypot(e.x-A.x, e.y-A.y) < e.r + C.range*SC){
        A.cd = C.gun.cd; pBullet(A.x, A.y, ang + (Math.random()-.5)*2*C.gun.spread, C.gun, e, LV(A.kind!)*HM.dmg()); sfx(C.sfx, .5);
      }
    } else A.aimA = A.a - Math.PI/2;
  }
  // heading home it matches the player's drift so it can catch the bay
  const ex = tx-A.x, ey = ty-A.y, el = Math.hypot(ex,ey) || 1, v = Math.min(C.spd*SC*(home ? 1.6 : 1), el*(home ? 3 : 2));
  const bx = home ? p.vx : 0, by = home ? p.vy : 0;
  A.vx += (ex/el*v + bx - A.vx)*Math.min(1, dt*C.agi*(home ? 2 : 1)); A.vy += (ey/el*v + by - A.vy)*Math.min(1, dt*C.agi*(home ? 2 : 1));
  A.x = clamp(A.x + A.vx*dt, 0, G.AW); A.y = clamp(A.y + A.vy*dt, 0, G.AH);
  if (A.vx*A.vx + A.vy*A.vy > 4) A.a += clamp(angDiff(Math.atan2(A.vx,-A.vy), A.a), -C.turn*dt, C.turn*dt);
}
// The railgun fires a slug that crosses its whole range in about a third of a second, piercing until its damage is spent.
export const SLUG_SPD = 3200;
export function fireRail(p: Ship, wx: number, wy: number, face: number){
  const R = T.rail.rail!, SC = G.SC, dx = Math.cos(face), dy = Math.sin(face), ox = wx + dx*BS*.5, oy = wy + dy*BS*.5, len = R.range*SC*cockpit().range;
  G.slugs.push({ox, oy, dx, dy, len, d:0, pool:R.pool*LV('rail')*HM.dmg()});
  boomAt(ox, oy, 6*SC, .1);
  const kick = 70*SC/Math.sqrt(p.ph.mass); p.vx -= dx*kick; p.vy -= dy*kick;
  if (!REDUCE) G.shake = Math.min(4, G.shake + 2.4);
}
/** Move the slugs on; each hits what lies on the stretch it just crossed. Past 60% of its range it loses up to 30% of its punch. */
export function updateSlugs(dt: number){
  const SC = G.SC;
  for (const S of G.slugs){
    const d0 = S.d; S.d = Math.min(S.len, S.d + SLUG_SPD*SC*dt);
    for (const h of rayHits(S.ox, S.oy, S.dx, S.dy, S.d, false)){
      if (h.t <= d0 || !h.e.alive || S.pool <= 0) continue;
      const b = h.e.blocks.get(h.k); if (!b) continue;
      const fall = 1 - .3*Math.max(0, h.t/S.len - .6)/.4, d = Math.min(S.pool, (b.hp + .01)/fall);
      damage(h.e, h.k, d*fall); S.pool -= d;
      sparks(S.ox + S.dx*h.t, S.oy + S.dy*h.t, Math.atan2(-S.dy, -S.dx), 3, 220*SC, ['#ffffff','#efe6ff']);
      if (S.pool <= 0){ S.d = h.t; boomAt(S.ox + S.dx*h.t, S.oy + S.dy*h.t, 10*SC, .2); }
    }
    // spent or out of range: leave the trace of its whole path, fading
    if (S.pool <= 0 || S.d >= S.len) G.beams.push({x1:S.ox, y1:S.oy, x2:S.ox + S.dx*S.d, y2:S.oy + S.dy*S.d, life:.35, max:.35, kind:'rail'});
  }
  G.slugs = G.slugs.filter(S => S.pool > 0 && S.d < S.len);
}
export function enemyFire(e: Ship, dt: number){
  const p = G.player!;
  if (e.boss){
    // capital ships sweep a slow spiral of rings
    e.ft -= dt;
    if (e.ft <= 0){
      e.ft = e.flag ? 1 : 1.1;
      const arms = e.flag ? 1 : 1 + (G.stage >= 6 ? 1 : 0);
      for (let q=0; q<arms; q++) eBullet(e.x, e.y, e.phase + q*TAU/arms, .7, 'ring', 8*eDmg());
      e.phase += .3*e.spin;
    }
  }
  // stagger the first shots so a fresh wave does not fire all at once
  if (!e.armed){ e.armed = true; for (const g of e.guns){ g.cd = rand(.6, ewOf(g.t)!.cd); g.shots = 0; } }
  e.sights = null;
  const tgt = e.boss ? p : e.tgt || p;
  if (tgt === p && G.cloakT > G.time) return; // the Phantom is cloaked: nothing to aim at
  for (const g of e.guns){
    if ((g.jam || 0) > G.time) continue;
    const w = ewOf(g.t)!, [wx,wy] = wpos(e,g), R = eReach(), sp = w.spd*e.sc*R;
    // turrets follow the player's rules: they fire within their arc around their facing, and not through their own hull
    const pg = T[g.t as BlockType].gun, arc = w.arc ?? (pg ? pg.arc ?? Math.PI : SWING), la = sp ? leadAngle(wx,wy,sp,.95,tgt) : Math.atan2(tgt.y-wy, tgt.x-wx);
    const clear = Math.abs(angDiff(la, e.a + FA[g.o])) <= arc && (!!w.over || !!pg?.over || !!pg?.homing || laneClear(e, g, la));
    // a beam keeps burning once lit, swinging after its target within its arc
    if (w.beam && (g.burnT || 0) > G.time){ eBeam(e, g, w.beam, w.range*e.sc*R, e.a + FA[g.o] + clamp(angDiff(la, e.a + FA[g.o]), -arc, arc), g.t==='glimmer', dt); continue; }
    g.cd -= dt;
    if (w.aim && g.cd < w.aim && clear) (e.sights ||= []).push([wx, wy, leadAngle(wx,wy,sp,.6,tgt)]);
    if (g.cd > 0) continue;
    if (w.range && Math.hypot(tgt.x-wx, tgt.y-wy) - tgt.r > w.range*e.sc*R){ g.cd = .3; g.shots = 0; continue; }
    if (!clear){ g.cd = .2; g.shots = 0; continue; }
    if (w.burst && (g.shots = (g.shots || 0) + 1) < w.burst) g.cd = w.gap!;
    else { g.shots = 0; g.cd = w.cd*rand(.85,1.15); }
    if (w.beam){ g.burnT = G.time + w.beam.dur; sfx('laser', .6); continue; }
    if (w.zap){ if (!eZap(e, wx, wy, tgt, w.range*e.sc*R, w.dmg*(e.fodder ? .5 : 1)*eDmg(), w.zap)) g.cd = .3; continue; }
    // a fast target is harder to lead: extra scatter grows with its speed, up to ±7° at 700 units/s
    const jit = tgt.craft ? 0 : .12*Math.min(1, Math.hypot(tgt.vx, tgt.vy)/(700*G.SC));
    const n = w.pellets || 1, a0 = leadAngle(wx,wy,sp,.95,tgt) + (Math.random()-.5)*2*((w.spread || 0) + jit);
    for (let q=0; q<n; q++){
      const ang = a0 + (n > 1 ? (q/(n-1) - .5)*(w.fan || 0) + rand(-.03,.03) : 0);
      const b = eBullet(wx, wy, ang, w.spd/110*e.sc/G.SC*R*(n > 1 ? rand(.9,1.1) : 1), w.kind, w.dmg*(e.fodder ? .5 : 1)*eDmg(), w.r*e.sc/G.SC);
      if (!b) break;
      if (w.range && !w.fuse && w.kind!=='emiss'){ b.life = b.life0 = w.range/(w.spd*EB_SPD); b.fall = true; }
      if (w.kind==='emiss'){ b.tgt = tgt; b.tr = []; b.life = b.life0 = 7; b.mirv = w.split || 0; }
      if (w.fuse){ b.fuse = w.fuse*e.sc; b.blast = w.blast!*e.sc; b.life = w.life!; }
      if (w.ion) b.ion = true;
    }
  }
}
/** One frame of an enemy beam from gun g along angle a: burns the first block of the player's side in reach, or the
 *  player's shield bubble if that comes first. */
function eBeam(e: Ship, g: Block, B: {dps: number; fall?: number}, range: number, a: number, pale: boolean, dt: number){
  const [wx,wy] = wpos(e,g), dx = Math.cos(a), dy = Math.sin(a), ox = wx + dx*BS*.5, oy = wy + dy*BS*.5;
  const hit = rayHits(ox, oy, dx, dy, range, true, 'p')[0], dps = B.dps*(e.fodder ? .5 : 1)*eDmg();
  let t = hit ? hit.t : range;
  const p = G.player;
  if (p?.alive) for (const s of p.shields){
    const bub = s.bub; if (!bub || bub.down > 0 || bub.hp <= 0) continue;
    // where the beam enters the bubble, if it does before its end
    const [cx,cy] = wpos(p,s), rx = cx-ox, ry = cy-oy, along = rx*dx + ry*dy, off = Math.abs(rx*dy - ry*dx), rad = shRad();
    if (off > rad || Math.hypot(rx, ry) < rad) continue;
    const enter = along - Math.sqrt(rad*rad - off*off); if (enter < 0 || enter > t) continue;
    t = enter; bub.hp -= dps*dt; bub.last = bub.flash = G.time; bub.ha = Math.atan2(-dy, -dx);
    if (bub.hp <= 0){ sfx('pop'); bub.hp = 0; bub.down = T.shield.sh!.down; G.fx.push({k:'ring', x:cx, y:cy, r:rad*1.1, life:.5, max:.5, col:'#5fd3ff'}); }
    G.beams.push({x1:ox, y1:oy, x2:ox + dx*t, y2:oy + dy*t, life:.06, max:.06, kind: pale ? 'eglim' : 'elaser'});
    return;
  }
  if (hit) damage(hit.e, hit.k, dps*(1 - (B.fall ?? .75)*hit.t/range)*dt);
  if (hit && Math.random() < .35) sparks(ox + dx*t, oy + dy*t, a + Math.PI, 1, 140*G.SC, pale ? ['#ffe0a0','#ffffff'] : ['#ff7a3a','#ffffff']);
  G.beams.push({x1:ox, y1:oy, x2:ox + dx*t, y2:oy + dy*t, life:.06, max:.06, kind: pale ? 'eglim' : 'elaser'});
}
/** An enemy Stormcoil: lightning to the target's nearest block in reach, then on to jumps-1 blocks close by. */
function eZap(e: Ship, wx: number, wy: number, tgt: Ship, range: number, dmg: number, jumps: number){
  let best: Key = -1, bd = range;
  for (const [k,b] of tgt.blocks){ const [bx,by] = wpos(tgt,b), d = Math.hypot(bx-wx, by-wy); if (d < bd){ bd = d; best = k; } }
  if (best < 0) return false;
  sfx('laser', .5);
  let lx = wx, ly = wy, k = best; const done = new Set<Key>();
  for (let q=0; q<jumps && k >= 0 && tgt.alive; q++){
    const b = tgt.blocks.get(k); if (!b) break;
    const [bx,by] = wpos(tgt,b);
    G.beams.push({x1:lx, y1:ly, x2:bx, y2:by, life:.15, max:.15, kind:'tesla'});
    damage(tgt, k, dmg); done.add(k); lx = bx; ly = by;
    // the next jump: the nearest untouched block within two cells
    let nk: Key = -1, nd = 2.2*BS;
    for (const [kk,bb] of tgt.blocks){ if (done.has(kk)) continue; const [x2,y2] = wpos(tgt,bb), d = Math.hypot(x2-lx, y2-ly); if (d < nd){ nd = d; nk = kk; } }
    k = nk;
  }
  return true;
}
// Enemy warhead or flak burst on a ship: every block within rad takes damage falling off from the centre.
export function blastShip(s: Ship, x: number, y: number, rad: number, dmg: number){
  for (const [k,bb] of [...s.blocks]){
    if (!s.alive || !s.blocks.has(k)) continue;
    const [wx,wy] = wpos(s,bb), d = Math.hypot(wx-x, wy-y);
    if (d < rad) damage(s, k, dmg*(1 - .6*d/rad));
  }
}
export function eBurst(b: Bullet){
  const blast = b.blast || 0;
  b.dead = true; boomAt(b.x, b.y, blast*.55, .25); sfx('boom', .4);
  sparks(b.x, b.y, 0, 6, 140*G.SC, ['#ffb03a','#ffe08a','#ffffff']);
  for (const s of G.ships) if (s.alive && s.team!=='e' && Math.hypot(s.x-b.x, s.y-b.y) < s.r + blast) blastShip(s, b.x, b.y, blast, b.dmg);
}
export function updateFx(dt: number){
  for (const f of G.fx){
    if (f.k==='boom' && (f.d || 0) > 0){ f.d! -= dt; if (f.d! <= 0) sfx('boom', .5); continue; } // a chained blast waiting its turn
    f.life -= dt;
    if (f.k==='deb'){
      // debris coasts with little drag, tumbling, trailing thin smoke; a few pop in a small blast as they burn out
      const k = Math.pow(.75, dt); f.x += f.vx*dt; f.y += f.vy*dt; f.vx *= k; f.vy *= k; f.a += f.va*dt;
      if (f.t && Math.random() < dt*5 && G.fx.length < 1600) G.fx.push({k:'smoke', x:f.x, y:f.y, vx:f.vx*.2, vy:f.vy*.2, r:rand(2,4)*G.SC, life:rand(.4,.8), max:.8});
      if (f.pop && f.life <= .9){ f.pop = false; f.life = Math.min(f.life, .12); boomAt(f.x, f.y, 5*G.SC, .25); sparks(f.x, f.y, 0, 5, 140*G.SC, ['#ffffff','#ffd0a0','#ff8a5a']); }
    }
    else if (f.k==='spk' || f.k==='smoke'){ f.x += f.vx*dt; f.y += f.vy*dt; f.vx *= .985; f.vy *= .985; }
    else if (f.k==='txt') f.y += f.vy*dt;
  }
  G.fx = G.fx.filter(f => f.life > 0);
  G.shake *= Math.pow(.004, dt);
  for (const b of G.beams) b.life -= dt;
  G.beams = G.beams.filter(b => b.life > 0);
  if (G.banner){ G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
}
