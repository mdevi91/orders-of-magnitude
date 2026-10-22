import { Quaternion, Vector3 } from 'three';
import { sfx } from './audio';
import { PD_KINDS, fallOff, flakBurst, jitter, mirvSplit, missileBlast, pBullet, shieldBlock } from './bullets';
import { BCOL, CRAFT, ESH, LV, T, def, grpOf, isCraft } from './catalog';
import { blastShip, eBurst, enemyFire, fireRail, launchCraft, launchECraft, updateCraft, updateECraft, updateFx } from './craft';
import { craftCap, faceQ, fightWon, fodderCap, inArena, playerDied, spawnSwarm, spawnWave } from './fights';
import { BS, DIRV, K, NB, SWING, clamp, rand } from './grid';
import { dirSpeed } from './physics';
import { cursorRay } from './render3d';
import { boomAt, damage, hitShip, impact, killShip, laneClear, rayHits, sparks, toLocal, toWorld, wpos } from './ships';
import { G, turnOf } from './state';
import type { Block, Bullet, Ship } from './types';
import { H, W } from './view';

// ---------- update ----------
/** Keys held down, by KeyboardEvent.code. */
export const keys: Record<string, boolean> = {};
export const JOY_R = 26;
const UP = new Vector3(0,1,0), tq = new Quaternion(), tv = new Vector3(), tv2 = new Vector3();

/** Turn a unit vector toward another by at most maxAng radians. */
export function turnToward(cur: Vector3, want: Vector3, maxAng: number){
  const ang = cur.angleTo(want);
  if (ang <= maxAng || ang < 1e-6) return cur.copy(want);
  return cur.applyQuaternion(tq.setFromUnitVectors(cur, want).slerp(new Quaternion(), 1 - maxAng/ang)).normalize();
}
/** Angular velocity (ship-local) that swings the nose toward a world point, keeping the ship roughly upright. */
export function steerTo(s: Ship, target: Vector3, gain: number, out = new Vector3()){
  const d = toLocal(s, tv.subVectors(target, s.p)).normalize();
  const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  const up = toLocal(s, UP, tv2), roll = Math.atan2(-up.x, up.y);
  return out.set(pitch*gain, yaw*gain, roll*gain*.5);
}
/** Spin a ship by its angular velocity (ship-local axes) for dt. */
export function spin(s: Ship, dt: number){
  const a = s.w.length()*dt;
  if (a > 1e-7){ s.q.multiply(tq.setFromAxisAngle(tv.copy(s.w).normalize(), a)); s.q.normalize(); }
}
export function update(dt: number){
  G.time += dt;
  const p = G.player!, SC = G.SC;
  const enemies = G.ships.filter(s => s.alive && s.team==='e'), allies = G.ships.filter(s => s.alive && s.team==='a');

  // the auto-aim point: the nearest hostile, led on its motion with a slow wobble, so auto fire is good but not perfect
  const auto = new Vector3();
  {
    let best: Ship | null = null, bd = 1e18;
    for (const e of enemies){ const d = e.p.distanceToSquared(p.p); if (d < bd){ bd = d; best = e; } }
    if (best){
      const w = best.wob ??= Math.random()*99, d = Math.sqrt(bd), amp = best.r*.9 + d*.06;
      const t = d/(550*SC)*(.4 + .4*Math.sin(G.time*.9 + w*.7));
      auto.copy(best.p).addScaledVector(best.v, t).add(tv.set(Math.sin(G.time*1.7 + w), Math.sin(G.time*2.3 + w*1.3), Math.sin(G.time*1.9 + w*.6)).multiplyScalar(amp));
    } else auto.copy(p.p).add(toWorld(p, DIRV[0], tv).multiplyScalar(300));
  }
  // the manual aim point: a set point, else what is under the mouse cursor, else the auto point
  const mouseAim = G.mouse.has && !G.aimAuto && !G.joy;
  if (G.aimAt) G.aim.copy(G.aimAt);
  else if (mouseAim){
    const ray = cursorRay(G.mouse.x, G.mouse.y);
    let hit = 1500*G.S;
    for (const e of enemies){ tv.subVectors(e.p, ray.origin); const t = tv.dot(ray.direction); if (t > 0 && t < hit && tv.addScaledVector(ray.direction, -t).length() < e.r*.8) hit = t; }
    G.aim.copy(ray.origin).addScaledVector(ray.direction, hit);
  } else G.aim.copy(auto);
  // desktop fires on click or Space; auto-aim, touch and mouse-less play fire on their own
  const fire = G.aimAuto || G.fireHeld || keys.Space || !G.mouse.has;
  const isAuto = (b: Block) => !!G.auto[grpOf(K(b.i,b.j,b.l), b.t)-1];
  const may = (b: Block) => fire || isAuto(b);

  const spend = (c: number) => { if (p.en < c) return false; p.en -= c; return true; };
  if (p.alive){
    p.en = Math.min(p.enMax, p.en + p.enRegen*dt);
    const ph = p.ph;
    for (const e of ph.engines) e.c.firing = false;
    // Movement: a world direction to go, from keys (ship-relative), the touch stick, or a set wish.
    // Top speed depends on how much engine thrust points that way; acceleration on thrust against mass.
    const wish = new Vector3(), kb = G.mouse.has && !G.joy;
    let analog = 1;
    if (G.moveWish) wish.copy(G.moveWish);
    else {
      const loc = new Vector3();
      if (keys.KeyW || keys.ArrowUp) loc.z--; if (keys.KeyS || keys.ArrowDown) loc.z++;
      if (keys.KeyA || keys.ArrowLeft) loc.x--; if (keys.KeyD || keys.ArrowRight) loc.x++;
      if (keys.KeyR) loc.y++; if (keys.KeyF) loc.y--;
      if (!loc.lengthSq() && G.joy){
        // touch: virtual stick, up is forward and sideways strafes
        const jx = G.joy.x - G.joy.x0, jy = G.joy.y - G.joy.y0, jl = Math.hypot(jx,jy);
        if (jl > 2){ loc.set(jx/jl, 0, jy/jl); analog = Math.min(1, jl/JOY_R); }
      }
      toWorld(p, loc, wish);
    }
    const ml = wish.length();
    if (ml) wish.divideScalar(ml);
    const local = toLocal(p, wish), thrust = ph.coreT + ph.F.px + ph.F.nx + ph.F.py + ph.F.ny + ph.F.pz + ph.F.nz;
    const spd = ml ? dirSpeed(ph, local)*SC*analog : 0, accel = clamp(1 + 4*Math.sqrt(thrust/Math.max(1, ph.mass)), 1, 6);
    p.v.lerp(tv.copy(wish).multiplyScalar(spd), Math.min(1, dt*(ml ? accel : accel*.6)));
    p.p.addScaledVector(p.v, dt);
    const before = tv2.copy(p.p); inArena(p.p);
    if (before.x !== p.p.x) p.v.x = 0; if (before.y !== p.p.y) p.v.y = 0; if (before.z !== p.p.z) p.v.z = 0;
    // engines pushing the way we go light up
    if (ml) for (const e of ph.engines) if (e.active && e.dir.dot(local) > .3) e.c.firing = true;
    // Turning. Mouse and keyboard: the ship steers toward the cursor (the further from the centre, the faster), Q/E roll.
    // Otherwise the nose swings to the aim point and the ship levels itself.
    const rate = turnOf(ph.torque, ph.inertia, ph.mass), wWant = new Vector3();
    if (kb && !G.aimAt){
      const dz = .06, ox = (G.mouse.x - W/2)/(W/2), oy = (G.mouse.y - H/2)/(H/2);
      const sx = Math.abs(ox) < dz ? 0 : ox - Math.sign(ox)*dz, sy = Math.abs(oy) < dz ? 0 : oy - Math.sign(oy)*dz;
      wWant.set(-sy*rate*1.4, -sx*rate*1.4, ((keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0))*rate);
    } else steerTo(p, G.aim, 4, wWant);
    wWant.clampLength(0, rate*1.2);
    // angular momentum: heavy hulls take time to start and stop a turn
    p.w.add(tv.subVectors(wWant, p.w).clampLength(0, rate*2.5*dt));
    spin(p, dt);
    if (p.w.length() > .2) for (const e of ph.engines) if (e.active) e.c.firing = e.c.firing || Math.random() < .3;

    // shields recharge after a quiet spell
    const SH = T.shield.sh!;
    for (const s of p.shields){
      const B = s.bub!;
      if (B.down > 0) B.down -= dt;
      else if (G.time - B.last > SH.delay && B.hp < B.max){
        const amt = Math.min(B.max - B.hp, SH.regen*dt, p.en/SH.en);
        B.hp += amt; p.en -= amt*SH.en;
      }
    }
  }

  // target helpers, shared by turrets, railguns and lasers
  const near = (pt: Vector3) => { let tg: Ship | null = null, td = 1e18; for (const e of enemies){ const d = e.p.distanceToSquared(pt); if (d < td){ td = d; tg = e; } } return tg; };
  const tgtM = near(G.aim);
  // Auto weapons pick their own target: the nearest hostile inside their reach and arc, led on its motion.
  // Slow guns leave fighters alone while anything bigger is in reach.
  const pick = (w: Vector3, face: Vector3, arc: number, reach: number, spd: number, fast: boolean): [Ship, Vector3] | null => {
    let best: Ship | null = null, bd = 1e18;
    for (const e of enemies){
      if (!e.alive) continue;
      const d = e.p.distanceTo(w) - e.r; if (d > reach) continue;
      if (arc < Math.PI && face.angleTo(tv.subVectors(e.p, w)) > arc + .25) continue;
      const score = d + (e.craft && !fast ? 600 : 0); if (score < bd){ bd = score; best = e; }
    }
    if (!best) return null;
    const b: Ship = best, t = spd ? b.p.distanceTo(w)/spd*rand(.7,1) : 0;
    return [b, b.p.clone().addScaledVector(b.v, t)];
  };
  if (p.alive && enemies.length){
    // turrets: inside their arc and with a clear line out of the hull
    for (const g of p.guns){
      if (!may(g)) continue;
      if (g.cd > 0){ g.cd -= dt; if (g.cd > 0) continue; }
      const gun = def(g.t)!.gun!, arc = gun.arc || 0, w = wpos(p,g), face = toWorld(p, DIRV[g.o]);
      let tg = tgtM, at = G.aim;
      if (isAuto(g)){
        const P = pick(w, face, arc, (gun.range || 1e4)*SC, gun.homing || gun.lob ? 0 : gun.spd*SC, gun.spd >= 600 || gun.fx==='flak');
        if (!P){ g.cd = .15; continue; }
        [tg, at] = P;
      }
      const dir = at.clone().sub(w).normalize();
      // out of range: hold fire rather than waste the shot
      if (gun.range && (!tg || tg.p.distanceTo(w) - tg.r > gun.range*SC)){ g.cd = .1; continue; }
      if (face.angleTo(dir) > arc) continue;
      g.aim = dir;
      if (!gun.homing && !gun.lob && !laneClear(p,g,dir)) continue;
      if (!spend(gun.en || 0)){ sfx('lowEn'); continue; }
      g.cd += gun.cd; if (g.cd < 0) g.cd = 0;
      const n = gun.pellets || 1;
      for (let q=0; q<n; q++) pBullet(w, jitter(n > 1 ? jitter(dir, (gun.fan || 0)/2) : dir, gun.spread), gun, tg, LV(g.t));
      sfx(gun.homing || gun.fx==='torp' ? 'missile' : gun.fx==='line' ? 'gatling' : gun.fx==='oval' || gun.fx==='pellet' ? 'cannon' : 'shot');
      if (gun.fx==='oval') boomAt(w.clone().addScaledVector(dir, 6), 5*SC, .07);
    }
    // railguns: fire when the aim point sits on their line
    const RG = T.rail.rail!;
    for (const h of p.rails){
      if (!may(h)) continue;
      if (h.cd > 0){ h.cd -= dt; if (h.cd > 0) continue; }
      if (!h.lane) continue;
      const w = wpos(p,h), face = toWorld(p, DIRV[h.o]), P = isAuto(h) ? pick(w, face, SWING, RG.range*SC, 0, true) : null;
      if (isAuto(h) && !P) continue;
      const tg = P ? P[0] : tgtM, dir = (P ? P[1] : G.aim).clone().sub(w).normalize();
      if (!tg || tg.p.distanceTo(w) - tg.r > RG.range*SC) continue;
      if (face.angleTo(dir) > SWING + .02) continue;
      if (!spend(RG.en)) continue;
      h.cd = RG.cd; fireRail(p, w, dir); sfx('rail');
    }
  }
  // lasers: continuous beam on whatever is first along their line within range
  if (p.alive) for (const h of p.lasers){
    h.beam = null; if (!h.lane || !enemies.length || !may(h)) continue;
    const L = T.laser.laser!, w = wpos(p,h), face = toWorld(p, DIRV[h.o]);
    const P = isAuto(h) ? pick(w, face, SWING, L.range*SC, 0, true) : null;
    if (isAuto(h) && !P) continue;
    const want = (P ? P[1] : G.aim).clone().sub(w).normalize(), dir = face.angleTo(want) <= SWING ? want : turnToward(face.clone(), want, SWING);
    const o = w.clone().addScaledVector(dir, BS*.5), range = L.range*SC;
    const hit = rayHits(o, dir, range, true)[0];
    if (hit && spend(L.en*dt)){
      sfx('laser');
      damage(hit.e, hit.k, L.dps*LV('laser')*(1 - .75*hit.t/range)*dt);
      h.beam = [o, o.clone().addScaledVector(dir, hit.t)];
      if (Math.random() < .35) sparks(h.beam[1], dir.clone().negate(), 1, 140*SC, ['#9dff8a','#ffffff']);
    }
  }
  // tesla coils: lightning to the nearest enemy block in reach, then on to blocks close by; an enemy missile if no hull is in reach
  if (p.alive) for (const c of p.teslas){
    if (!may(c) || (c.cd -= dt) > 0) continue;
    const Z = T.tesla.tesla!, w = wpos(p,c), R = Z.range*SC, bp = new Vector3();
    let hit: [Ship, number] | null = null, hd = R*R;
    for (const e of enemies){
      if (!e.alive || e.p.distanceTo(w) > R + e.r) continue;
      for (const [k,bb] of e.blocks){ const q = wpos(e, bb, bp).distanceToSquared(w); if (q < hd){ hd = q; hit = [e,k]; } }
    }
    if (!hit){
      let mb: Bullet | null = null; for (const b of G.eb){ if (b.dead || b.kind!=='emiss') continue; const q = b.p.distanceToSquared(w); if (q < hd){ hd = q; mb = b; } }
      if (mb && spend(Z.en)){ mb.dead = true; c.cd = Z.cd*.5; G.beams.push({a:w, b:mb.p.clone(), life:.15, max:.15, kind:'tesla'}); sfx('pd'); }
      else c.cd = .15;
      continue;
    }
    if (!spend(Z.en)){ c.cd = .3; continue; }
    c.cd = Z.cd; sfx('laser');
    const e = hit[0]; let k = hit[1], last = w;
    const done = new Set<number>();
    for (let n=0; n<Z.jumps && e.alive && e.blocks.has(k); n++){
      const at = wpos(e, e.blocks.get(k)!);
      G.beams.push({a:last, b:at, life:.15, max:.15, kind:'tesla'});
      sparks(at, null, 3, 120*SC, ['#e8dcff','#ffffff']);
      damage(e, k, Z.dmg*LV('tesla')); done.add(k); last = at;
      // jump to the closest untouched block within two cells
      let nk: number | null = null, nd = (2.2*BS)**2;
      if (e.alive) for (const [kk,b2] of e.blocks){ if (done.has(kk)) continue; const q = wpos(e, b2, bp).distanceToSquared(last); if (q < nd){ nd = q; nk = kk; } }
      if (nk == null) break; k = nk;
    }
  }
  // point defense
  if (p.alive) for (const d of p.pds){
    d.cd -= dt; if (d.cd > 0) continue;
    const PD = T.pd.pd!, w = wpos(p,d), R = PD.range*Math.sqrt(G.S);
    let best: Bullet | null = null, bd = R*R;
    for (const b of G.eb){ if (b.dead || !PD_KINDS.has(b.kind)) continue; const q = b.p.distanceToSquared(w); if (q < bd){ bd = q; best = b; } }
    if (best && spend(PD.en)){ sfx('pd'); best.dead = true; d.cd = PD.cd/LV('pd'); G.beams.push({a:w, b:best.p.clone(), life:.09, max:.09, kind:'pd'}); }
    else d.cd = .05;
  }
  // hangar bays: launch a craft, take it back after its sortie, send it out again; a lost craft takes longer to replace
  if (p.alive) for (const b of p.bays){
    if (!isCraft(b.t)) continue;
    if (b.ally && !b.ally.alive){ b.ally = null; b.bt = CRAFT[b.t].rebuild; }
    if (!b.ally && (b.bt = (b.bt || 0) - dt) <= 0) launchCraft(p,b);
  }
  for (const A of allies) if (A.alive) updateCraft(A, dt, enemies);

  // enemies
  const tq2 = new Quaternion();
  for (const e of enemies){
    if (e.craft){ updateECraft(e, dt, allies); continue; }
    // aimed guns switch to a hangar craft that comes much closer than the player
    let td = e.p.distanceTo(p.p)*.6; e.tgt = p;
    for (const A of allies){ const d = A.p.distanceTo(e.p); if (A.alive && d < td){ td = d; e.tgt = A; } }
    if (e.station) e.q.premultiply(tq2.setFromAxisAngle(UP, .03*e.spin*dt)); // starbases turn slowly in place
    else {
      // swing the nose toward the player, and circle at the preferred distance around the enemy's own axis
      e.q.rotateTowards(faceQ(e.p, p.p, tq2), e.turn*dt);
      e.orb += e.orbSpd*dt;
      const u = tv.set(1,0,0).cross(e.orbAxis); if (u.lengthSq() < 1e-4) u.set(0,0,1).cross(e.orbAxis);
      u.normalize(); const v = tv2.crossVectors(e.orbAxis, u);
      const target = inArena(p.p.clone().addScaledVector(u, Math.cos(e.orb)*e.pref).addScaledVector(v, Math.sin(e.orb)*e.pref));
      const to = target.sub(e.p), el = to.length() || 1, sp = Math.min(e.vmax*e.sc, el*1.2);
      e.v.lerp(to.multiplyScalar(sp/el), Math.min(1, dt*1.4));
      e.p.addScaledVector(e.v, dt);
    }
    // ramming: ships under a third of the player's size break up on the hull
    if (p.alive && e.r < p.r*.35 && e.p.distanceTo(p.p) < p.r + e.r){
      const k = hitShip(p, e.p, e.r*.5);
      if (k >= 0){ damage(p, k, 1 + e.blocks.size*.4); G.shake = Math.max(G.shake, 2); sfx('ram'); killShip(e); continue; }
    }
    if (p.alive && !((e.jam || 0) > G.time)) enemyFire(e, dt*e.fireMul);
    // point defense: shoots down the player's missiles and MIRV warheads
    for (const d of e.epd){
      d.cd = (d.cd ?? rand(0,.6)) - dt; if (d.cd > 0) continue;
      const w = wpos(e,d), R = 75*e.sc;
      let best: Bullet | null = null, bd = R*R;
      for (const b of G.pb){ if (b.dead || !b.homing) continue; const q = b.p.distanceToSquared(w); if (q < bd){ bd = q; best = b; } }
      if (best){ best.dead = true; d.cd = .75; G.beams.push({a:w, b:best.p.clone(), life:.09, max:.09, kind:'epd'}); boomAt(best.p, 4*SC, .12); }
      else d.cd = .1;
    }
    for (const sb of e.shields){
      const B = sb.bub!;
      if (B.down > 0) B.down -= dt; else if (G.time - B.last > ESH.delay) B.hp = Math.min(B.max, B.hp + ESH.regen*e.hpMul*dt);
    }
    // carriers fly the player's fighters and bombers: one craft per bay at a time, a new one some time after it is lost
    if (e.bays.length && p.alive) for (const b of e.bays){
      if (b.craft && b.craft.alive) continue;
      b.bt = (b.bt ?? rand(2,5)) - dt;
      if (b.bt <= 0 && G.ships.filter(x => x.alive && x.craft).length < craftCap()){ b.bt = 14; b.craft = launchECraft(e, b); }
    }
  }
  // hulls push apart; a starbase never gets pushed, whoever bumps it moves the whole way
  for (let a=0; a<enemies.length; a++) for (let b=a+1; b<enemies.length; b++){
    const A = enemies[a], B = enemies[b]; if (A.craft || B.craft) continue;
    const d = tv.subVectors(B.p, A.p), len = d.length() || 1, min = (A.r+B.r)*.95;
    if (len < min){ const push = (min-len)*.5*Math.min(1,dt*6), wa = A.station ? 0 : B.station ? 2 : 1, wb = 2 - wa; d.divideScalar(len); A.p.addScaledVector(d, -push*wa); B.p.addScaledVector(d, push*wb); }
  }

  // bullets
  const mX = 150*G.S, out = (b: Bullet) => Math.abs(b.p.x) > G.AW+mX || Math.abs(b.p.y) > G.AH+mX || Math.abs(b.p.z) > G.AD+mX;
  for (const b of G.pb){
    if (b.dead) continue;
    if (b.kind==='mine') b.v.multiplyScalar(Math.pow(.35, dt));
    if (b.homing){
      if (!b.target || !b.target.alive){ let bd = 1e18; b.target = null; for (const e of enemies){ const d = e.p.distanceToSquared(b.p); if (d < bd){ bd = d; b.target = e; } } }
      // guidance burns out after 2 s; after that the warhead flies straight
      if (b.target && b.life > 4){
        const cur = tv.copy(b.v).normalize();
        turnToward(cur, tv2.subVectors(b.target.p, b.p).normalize(), 1.5*dt);
        b.v.copy(cur).multiplyScalar(b.sp);
      }
      if (b.mirv && (b.life < 5.2 || (b.target && b.target.p.distanceTo(b.p) < b.target.r + 90*SC))){ mirvSplit(b, enemies); continue; }
      if (Math.random() < .18) G.fx.push({k:'smoke', p:b.p.clone(), v:new Vector3(rand(-6,6),rand(-6,6),rand(-6,6)).multiplyScalar(SC), r:2.2*SC, life:rand(.5,.9), max:.9});
    }
    const steps = Math.min(3, Math.ceil(b.sp*dt/(BS*.8)));
    for (let s=0; s<steps && !b.dead; s++){
      b.p.addScaledVector(b.v, dt/steps);
      for (const e of enemies){
        if (!e.alive) continue;
        if (e.shields.length && shieldBlock(e,b)){ b.dead = true; break; }
        const burst = b.kind==='flak' || b.kind==='mine', k = hitShip(e, b.p, burst ? b.fuse || 0 : b.r);
        if (k >= 0 && burst){ flakBurst(b); break; }
        if (k >= 0){
          b.dmg *= fallOff(b); damage(e,k,b.dmg); b.dead = true; if (b.kind==='oval') impact(b,e,k); if (b.homing) missileBlast(b,e,k);
          if (b.kind==='torp'){ missileBlast(b,e,k); impact(b,e,k); }
          if (b.ion){ e.jam = G.time + (e.boss ? .4 : 1.5); sparks(b.p, null, 6, 120*SC, ['#5fe0ff','#ffffff']); }
          G.fx.push({k:'spk', p:b.p.clone(), v:b.v.clone().multiplyScalar(-.1), life:.18, max:.18, col:'#ffffff'}); break;
        }
      }
    }
    b.life -= dt;
    if ((b.kind==='flak' || b.kind==='mine') && !b.dead && b.life <= 0) flakBurst(b);
    if (b.life <= 0 || out(b)) b.dead = true;
  }
  for (const b of G.eb){
    if (b.dead) continue;
    if (b.kind==='emiss'){
      // enemy missiles home for 2 s like the player's
      const t = b.tgt && b.tgt.alive ? b.tgt : p;
      if (b.life > 6){ const cur = tv.copy(b.v).normalize(); turnToward(cur, tv2.subVectors(t.p, b.p).normalize(), 1.5*dt); b.v.copy(cur).multiplyScalar(b.sp); }
    }
    if (b.kind==='eflak'){
      // flak bursts when it comes near a hull or runs out of fuse
      let near = b.life <= dt;
      for (const s of G.ships) if (!near && s.alive && s.team!=='e' && hitShip(s, b.p, b.fuse || 0) >= 0) near = true;
      if (near){ eBurst(b); continue; }
    }
    const steps = b.sp*dt > 6 ? 2 : 1;
    for (let s=0; s<steps && !b.dead; s++){
      b.p.addScaledVector(b.v, dt/steps);
      if (p.alive){
        if (shieldBlock(p,b)){ b.dead = true; break; }
        const k = hitShip(p, b.p, b.r);
        if (k >= 0){
          b.dmg *= fallOff(b); damage(p,k,b.dmg); sfx('hit'); b.dead = true; G.fx.push({k:'spk', p:b.p.clone(), v:new Vector3(), life:.2, max:.2, col:BCOL[b.kind]});
          if (b.kind==='snipe') boomAt(b.p, 8*SC, .2);
          if (b.kind==='eoval'){ if (p.alive) for (const d of NB) if (p.blocks.has(k+d)) damage(p, k+d, b.dmg*.4); boomAt(b.p, 9*SC, .2); }
          if (b.kind==='emiss'){ blastShip(p, b.p, 1.6*BS, b.dmg*.6); boomAt(b.p, 16*SC, .35); sfx('boom', .6); }
          break;
        }
      }
      for (const A of allies){
        const k = A.alive ? hitShip(A, b.p, b.r) : -1;
        if (k >= 0){ damage(A,k,b.dmg); b.dead = true; G.fx.push({k:'spk', p:b.p.clone(), v:new Vector3(), life:.2, max:.2, col:BCOL[b.kind]}); break; }
      }
    }
    b.life -= dt;
    if (b.life <= 0 || out(b)) b.dead = true;
  }
  G.pb = G.pb.filter(b => !b.dead); G.eb = G.eb.filter(b => !b.dead);
  G.ships = G.ships.filter(s => s.alive || s===p);

  updateFx(dt);

  // at gates and flagships a swarm keeps coming between and during waves; it never holds up a win
  if (p.alive && (G.fight==='gate' || G.fight==='boss' || G.fight==='station') && G.waveIdx > 0){
    G.swarmT -= dt;
    if (G.swarmT <= 0){ G.swarmT = 12; if (enemies.filter(e => e.alive && e.fodder).length < fodderCap()) spawnSwarm(); }
  }

  // waves
  if (!p.alive){ G.deadT -= dt; if (G.deadT <= 0) playerDied(); }
  else if (!enemies.some(e => e.alive && !e.fodder)){
    G.waveGap -= dt;
    if (G.waveGap <= 0){
      if (G.waveIdx < G.waves.length){ G.waveIdx++; spawnWave(G.waves[G.waveIdx-1]); G.waveGap = 1.6; }
      else fightWon();
    }
  }
}
