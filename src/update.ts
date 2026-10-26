import { sfx } from './audio';
import { PD_KINDS, fallOff, flakBurst, mirvSplit, missileBlast, pBullet, shieldBlock } from './bullets';
import { BCOL, CRAFT, ESH, HM, LV, T, cockpit, cpSpeed, cpTurn, def, grpOf, isCraft } from './catalog';
import { blastShip, eBurst, enemyFire, fireRail, launchCraft, launchECraft, updateCraft, updateECraft, updateFx } from './craft';
import { cellsFor } from './editor';
import { craftCap, fightWon, fodderCap, playerDied, spawnSwarm, spawnWave } from './fights';
import { BS, FA, K, NB, SWING, angDiff, clamp, rand } from './grid';
import { dirSpeed } from './physics';
import { boomAt, broadside, damage, hitShip, impact, killShip, laneClear, rayHits, sparks, wpos } from './ships';
import { G, turnOf } from './state';
import type { Block, Ship } from './types';
import { H, W } from './view';

// ---------- update ----------
/** Keys held down, by KeyboardEvent.code. */
export const keys: Record<string, boolean> = {};
export const JOY_R = 26;
// Auto fire picks a drifting spot somewhere on the target's hull (and a little past its edge further out), not its centre.
export function wobble(e: Ship, d: number): [number, number] {
  const w = e.wob ??= Math.random()*99, amp = e.r*1.1 + d*.03;
  return [Math.sin(G.time*1.7 + w)*Math.cos(G.time*.6 + w*.4)*amp, Math.sin(G.time*2.3 + w*1.3)*Math.cos(G.time*.8 + w*.9)*amp];
}
// An ion bolt jams the enemy weapons near the block it hits (turrets, point defense, carrier bays) for ION_T seconds.
export const ION_R = 2.5, ION_T = 1.5;
export function ionJam(e: Ship, hit: Block){
  for (const g of [...e.guns, ...e.epd, ...e.bays]) if (Math.hypot(g.i-hit.i, g.j-hit.j) <= ION_R) g.jam = G.time + ION_T;
}
/** Fires the cockpit's right-click ability toward the aim point (ax, ay); (ux, uy) is the way the player is steering, if any. */
export function useAbility(p: Ship, ax: number, ay: number, ux: number, uy: number){
  const C = cockpit(), SC = G.SC;
  G.abT = C.abCd;
  if (C.ab==='jump'){
    // a short warp jump toward the mouse, drawn like an enemy jumping in: out with a flash, back in along a streak
    const dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy) || 1, L = clamp(d, 120*SC, 280*SC);
    const tx = clamp(p.x + dx/d*L, 0, G.AW), ty = clamp(p.y + dy/d*L, 0, G.AH);
    boomAt(p.x, p.y, p.r*.7 + 6*SC, .15); sparks(p.x, p.y, Math.atan2(dy, dx), 10, 380*SC, ['#ffffff','#a8ecff','#c8b0ff']);
    p.warpA = Math.atan2(p.y - ty, p.x - tx); p.x = tx; p.y = ty; p.warp = .3; sfx('launch', .8);
  } else {
    // evasive roll: a hard shove the way the ship is steering (or toward the mouse), and half a second untouchable
    let vx = ux, vy = uy; if (!vx && !vy){ const d = Math.hypot(ax - p.x, ay - p.y) || 1; vx = (ax - p.x)/d; vy = (ay - p.y)/d; }
    p.vx += vx*520*SC; p.vy += vy*520*SC; p.ghost = G.time + .5; sfx('launch', .5);
  }
}
export function update(dt: number){
  const RM = cockpit().range; // the command bridge stretches every weapon's reach
  G.time += dt;
  if (G.stats) G.stats.secs = (G.stats.secs || 0) + dt;
  const p = G.player!, SC = G.SC;
  for (const s of G.ships){ s.c = Math.cos(s.a); s.sn = Math.sin(s.a); }
  // ships still in their jump in can't be hit and don't act; they drop out with a flash
  for (const s of G.ships) if (s.warp && s.warp > 0 && (s.warp -= dt) <= 0){
    s.warp = 0; sfx('launch', .8);
    G.fx.push({k:'ring', x:s.x, y:s.y, r:s.r*2.2 + 30*SC, life:.5, max:.5, col:'#c8e8ff'});
    boomAt(s.x, s.y, s.r*.9 + 8*SC, .18);
    sparks(s.x, s.y, s.warpA! + Math.PI, 14, 420*SC, ['#ffffff','#a8ecff','#c8b0ff']);
  }
  const arriving = G.ships.some(s => s.alive && s.team==='e' && !s.fodder && (s.warp || 0) > 0);
  const enemies = G.ships.filter(s => s.alive && s.team==='e' && !((s.warp || 0) > 0)), allies = G.ships.filter(s => s.alive && s.team==='a');

  // aim
  let ax: number | undefined, ay = 0;
  const aj = G.aimJoy, ajl = aj ? Math.hypot(aj.x-aj.x0, aj.y-aj.y0) : 0;
  if (aj && ajl > 4){ ax = p.x + (aj.x-aj.x0)/ajl*600*G.S; ay = p.y + (aj.y-aj.y0)/ajl*600*G.S; }
  else if (!G.aimAuto && G.mouse.has){ ax = (G.mouse.x - W/2)/G.zoom + G.camX; ay = (G.mouse.y - H/2)/G.zoom + G.camY; }
  // the auto-aim point: auto-aim, touch without an aim stick, and weapon groups on auto all use it
  let px: number, py: number;
  {
    let best: Ship | null = null, bd = 1e18;
    for (const e of enemies){ const d = (e.x-p.x)**2 + (e.y-p.y)**2; if (d < bd){ bd = d; best = e; } }
    // a loose lead on the target's movement plus a wide wobble, so auto fire is rough and misses a lot
    if (best){
      const d = Math.sqrt(bd), [ox,oy] = wobble(best, d);
      // lead drifts between under- and over-leading
      const t = d/(550*SC)*(.3 + .6*Math.sin(G.time*.9 + best.wob!*.7));
      px = best.x + best.vx*t + ox;
      py = best.y + best.vy*t + oy;
    } else { px = p.x; py = p.y - 100; }
  }
  if (ax === undefined){ ax = px; ay = py; }
  G.aim = {x:ax, y:ay};
  // desktop fires on click or Space; auto-aim, touch and mouse-less play fire on their own
  const fire = G.aimAuto || G.fireHeld || keys.Space || !G.mouse.has;
  // per weapon type: may it fire now, and where does it aim
  const isAuto = (b: Block) => !!G.auto[grpOf(K(b.i,b.j), b.t)-1];
  const may = (b: Block) => fire || isAuto(b), aimX = (b: Block) => isAuto(b) ? px : ax!, aimY = (b: Block) => isAuto(b) ? py : ay;

  const spend = (c: number) => { if (p.en < c) return false; p.en -= c; return true; };
  if (p.alive){
    p.en = Math.min(p.enMax, p.en + p.enRegen*dt);
    const ph = p.ph;
    for (const e of ph.engines) e.c.firing = false;
    // movement: top speed depends on how much engine thrust points the way you want to go.
    // Mouse and keyboard fly the ship: W/S thrust along the nose, A/D turn; holding Shift the nose follows the mouse and A/D strafe,
    // or, with the screen setting, WASD moves straight up, left, down and right.
    // Touch (and mouse-less play) moves in screen directions with the nose on the aim point.
    let mx = 0, my = 0, turnIn = 0;
    const kb = G.mouse.has && !G.joy, shift = keys.ShiftLeft || keys.ShiftRight;
    if (kb && !(shift && G.shiftAbs)){
      let f = 0, s = 0;
      if (keys.KeyW || keys.ArrowUp) f++; if (keys.KeyS || keys.ArrowDown) f--;
      if (keys.KeyA || keys.ArrowLeft){ if (shift) s--; else turnIn--; }
      if (keys.KeyD || keys.ArrowRight){ if (shift) s++; else turnIn++; }
      // the nose points along (sin a, -cos a); starboard is (cos a, sin a)
      mx = f*p.sn + s*p.c; my = -f*p.c + s*p.sn;
    } else {
      if (keys.KeyA || keys.ArrowLeft) mx--; if (keys.KeyD || keys.ArrowRight) mx++;
      if (keys.KeyW || keys.ArrowUp) my--; if (keys.KeyS || keys.ArrowDown) my++;
    }
    // touch: virtual joystick around where the thumb landed, analog up to JOY_R canvas pixels
    let analog = 1;
    if (!mx && !my && G.joy){
      const jx = G.joy.x - G.joy.x0, jy = G.joy.y - G.joy.y0, jl = Math.hypot(jx,jy);
      if (jl > 2){ mx = jx/jl; my = jy/jl; analog = Math.min(1, jl/JOY_R); }
    }
    const ml = Math.hypot(mx,my), ux = ml ? mx/ml : 0, uy = ml ? my/ml : 0;
    const lx = ux*p.c + uy*p.sn, ly = -ux*p.sn + uy*p.c;
    const spd = ml ? dirSpeed(ph,lx,ly)*SC*analog*cpSpeed() : 0;
    p.vx += (ux*spd - p.vx)*Math.min(1,dt*(ml ? 5 : 3));
    p.vy += (uy*spd - p.vy)*Math.min(1,dt*(ml ? 5 : 3));
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.x = clamp(p.x, 0, G.AW); p.y = clamp(p.y, 0, G.AH);
    // the cockpit ability, on right-click or E
    if (G.abT > 0) G.abT -= dt;
    if (G.abReq){ G.abReq = false; if (G.abT <= 0 && !((p.warp || 0) > 0)) useAbility(p, ax!, ay, ux, uy); }
    // engines pushing the way we go light up; off-centre ones twist the hull
    let drift = 0;
    if (ml) for (const e of ph.engines){
      if (!e.active) continue;
      if ((e.tx*lx + e.ty*ly)/T.engine.thrust! > .3){ e.c.firing = true; drift += e.tau; }
    }
    p.a += drift/ph.inertia*dt;
    // nose swings toward the aim point (or turns on A/D); engines whose push helps the turn act as jets
    const aimTurn = !kb || shift, want = Math.atan2(ax!-p.x, -(ay-p.y)), da = aimTurn ? angDiff(want,p.a) : turnIn, cw = da > 0;
    const rate = turnOf(ph.torque + (cw ? ph.jetCW : ph.jetCCW), ph.inertia, ph.mass)*cpTurn();
    // angular momentum: heavy hulls take time to start and stop a turn
    const wWant = aimTurn ? clamp(da*4, -rate, rate) : turnIn*rate, acc = rate*2.5;
    p.w = (p.w||0) + clamp(wWant - (p.w||0), -acc*dt, acc*dt);
    p.a += p.w*dt;
    if (aimTurn ? Math.abs(da) > .06 : turnIn) for (const e of ph.engines) if (e.active && (cw ? e.tau > 0 : e.tau < 0)) e.c.firing = true;
    p.c = Math.cos(p.a); p.sn = Math.sin(p.a);

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
  const near = (x: number, y: number) => { let tg: Ship | null = null, td = 1e18; for (const e of enemies){ const d = (e.x-x)**2 + (e.y-y)**2; if (d < td){ td = d; tg = e; } } return tg; };
  const tgtM = near(ax!,ay);
  // Auto weapons pick their own target: the nearest hostile inside their reach and arc, led on its motion.
  // Slow guns leave fighters alone while anything bigger is in reach.
  const pick = (wx: number, wy: number, face: number, arc: number, reach: number, spd: number, fast: boolean): [Ship, number, number] | null => {
    let best: Ship | null = null, bd = 1e18;
    for (const e of enemies){
      if (!e.alive) continue;
      const d = Math.hypot(e.x-wx, e.y-wy) - e.r; if (d > reach) continue;
      if (arc < Math.PI && Math.abs(angDiff(Math.atan2(e.y-wy, e.x-wx), face)) > arc + .25) continue;
      const score = d + (e.craft && !fast ? 600 : 0); if (score < bd){ bd = score; best = e; }
    }
    if (!best) return null;
    const b: Ship = best, d = Math.hypot(b.x-wx, b.y-wy), t = spd ? d/spd*rand(.2,1.3) : 0, [ox,oy] = wobble(b, d);
    return [b, b.x + b.vx*t + ox, b.y + b.vy*t + oy];
  };
  if (p.alive && enemies.length){
    // turrets: inside their arc and with a clear line out of the hull
    for (const g of p.guns){
      if (!may(g)) continue;
      if (g.cd > 0){ g.cd -= dt; if (g.cd > 0) continue; }
      const gun = def(g.t)!.gun!, arc = gun.arc || 0, [wx,wy] = wpos(p,g);
      let tg = tgtM, tx = aimX(g), ty = aimY(g);
      if (isAuto(g)){
        const P = pick(wx, wy, p.a + FA[g.o], arc, (gun.range || 1e4)*SC*RM, gun.homing || gun.lob ? 0 : gun.spd*SC, gun.spd >= 600 || gun.fx==='flak');
        if (!P){ g.cd = .15; continue; }
        [tg, tx, ty] = P;
      }
      const ang = Math.atan2(ty-wy, tx-wx);
      // out of range: hold fire rather than waste the shot
      if (gun.range && (!tg || Math.hypot(tg.x-wx, tg.y-wy) - tg.r > gun.range*SC*RM)){ g.cd = .1; continue; }
      if (Math.abs(angDiff(ang, p.a + FA[g.o])) > arc) continue;
      if (!gun.homing && !gun.lob && !gun.over && !laneClear(p,g,ang)) continue;
      if (!spend(gun.en || 0)){ sfx('lowEn'); continue; }
      g.cd += gun.cd; if (g.cd < 0) g.cd = 0;
      const n = gun.pellets || 1;
      for (let q=0; q<n; q++) pBullet(wx, wy, ang + (n > 1 ? (q/(n-1) - .5)*(gun.fan || 0) : 0) + (Math.random()-.5)*2*gun.spread, gun, tg, LV(g.t)*HM.dmg());
      sfx(gun.homing || gun.fx==='torp' ? 'missile' : gun.fx==='line' ? 'gatling' : gun.fx==='oval' || gun.fx==='pellet' ? 'cannon' : 'shot');
      if (gun.fx==='oval') boomAt(wx + Math.cos(ang)*6, wy + Math.sin(ang)*6, 5*SC, .07);
    }
    // railguns: fire when the aim point sits on their line
    const RG = T.rail.rail!;
    for (const h of p.rails){
      if (!may(h)) continue;
      if (h.cd > 0){ h.cd -= dt; if (h.cd > 0) continue; }
      if (!h.lane) continue;
      const [wx,wy] = wpos(p,h), face = p.a + FA[h.o], P = isAuto(h) ? pick(wx, wy, face, SWING, RG.range*SC*RM, 0, true) : null;
      if (isAuto(h) && !P) continue;
      const tg = P ? P[0] : tgtM, off = angDiff(Math.atan2((P ? P[2] : aimY(h))-wy, (P ? P[1] : aimX(h))-wx), face);
      if (!tg || Math.hypot(tg.x-wx, tg.y-wy) - tg.r > RG.range*SC*RM) continue;
      if (Math.abs(off) > SWING + .02) continue;
      if (!spend(RG.en)) continue;
      h.cd = RG.cd; fireRail(p, wx, wy, face + clamp(off, -SWING, SWING)); sfx('rail');
    }
  }
  // lasers: continuous beam on whatever is first along their line within range
  if (p.alive) for (const h of p.lasers){
    h.beam = null; if (!h.lane || !enemies.length || !may(h)) continue;
    const L = T.laser.laser!, [wx,wy] = wpos(p,h), base = p.a + FA[h.o];
    const P = isAuto(h) ? pick(wx, wy, base, SWING, L.range*SC*RM, 0, true) : null;
    if (isAuto(h) && !P) continue;
    const face = base + clamp(angDiff(Math.atan2((P ? P[2] : aimY(h))-wy, (P ? P[1] : aimX(h))-wx), base), -SWING, SWING), dx = Math.cos(face), dy = Math.sin(face);
    const ox = wx + dx*BS*.5, oy = wy + dy*BS*.5, range = L.range*SC*RM;
    const hit = rayHits(ox, oy, dx, dy, range, true)[0];
    if (hit && spend(L.en*dt)){
      sfx('laser');
      damage(hit.e, hit.k, L.dps*LV('laser')*HM.dmg()*(1 - .75*hit.t/range)*dt);
      h.beam = [ox, oy, ox + dx*hit.t, oy + dy*hit.t];
      if (Math.random() < .35) sparks(ox + dx*hit.t, oy + dy*hit.t, face+Math.PI, 1, 140*SC, ['#9dff8a','#ffffff']);
    }
  }
  // tesla coils: lightning to the nearest enemy block in reach, then on to blocks close by; an enemy missile if no hull is in reach
  if (p.alive) for (const c of p.teslas){
    if (!may(c) || (c.cd -= dt) > 0) continue;
    const Z = T.tesla.tesla!, [wx,wy] = wpos(p,c), R = Z.range*SC*RM;
    let hit: [Ship, number, number, number] | null = null, hd = R*R;
    for (const e of enemies){
      if (!e.alive || Math.hypot(e.x-wx, e.y-wy) > R + e.r) continue;
      for (const [k,bb] of e.blocks){ const [bx,by] = wpos(e,bb), q = (bx-wx)**2 + (by-wy)**2; if (q < hd){ hd = q; hit = [e,k,bx,by]; } }
    }
    if (!hit){
      let mb: typeof G.eb[number] | null = null; for (const b of G.eb){ if (b.dead || b.kind!=='emiss') continue; const q = (b.x-wx)**2 + (b.y-wy)**2; if (q < hd){ hd = q; mb = b; } }
      if (mb && spend(Z.en)){ mb.dead = true; c.cd = Z.cd*.5; G.beams.push({x1:wx, y1:wy, x2:mb.x, y2:mb.y, life:.15, max:.15, kind:'tesla'}); sfx('pd'); }
      else c.cd = .15;
      continue;
    }
    if (!spend(Z.en)){ c.cd = .3; continue; }
    c.cd = Z.cd; sfx('laser');
    const e = hit[0]; let k = hit[1], lx = wx, ly = wy;
    const done = new Set<number>();
    for (let n=0; n<Z.jumps && e.alive && e.blocks.has(k); n++){
      const [bx,by] = wpos(e, e.blocks.get(k)!);
      G.beams.push({x1:lx, y1:ly, x2:bx, y2:by, life:.15, max:.15, kind:'tesla'});
      sparks(bx, by, 0, 3, 120*SC, ['#e8dcff','#ffffff']);
      damage(e, k, Z.dmg*LV('tesla')*HM.dmg()); done.add(k); lx = bx; ly = by;
      // jump to the closest untouched block within two cells
      let nk: number | null = null, nd = (2.2*BS)**2;
      if (e.alive) for (const [kk,b2] of e.blocks){ if (done.has(kk)) continue; const [x2,y2] = wpos(e,b2), q = (x2-lx)**2 + (y2-ly)**2; if (q < nd){ nd = q; nk = kk; } }
      if (nk == null) break; k = nk;
    }
  }
  // point defense
  if (p.alive) for (const d of p.pds){
    d.cd -= dt; if (d.cd > 0) continue;
    // a multi-cell battery fires from the middle of its footprint
    const PD = def(d.t)!.pd!, cs = cellsFor(d.i, d.j, d.t, d.o), [wx,wy] = wpos(p, {i:cs.reduce((a,c) => a + c[0], 0)/cs.length, j:cs.reduce((a,c) => a + c[1], 0)/cs.length}), R = PD.range*Math.sqrt(G.S)*RM;
    let best: typeof G.eb[number] | null = null, bd = R*R;
    for (const b of G.eb){ if (b.dead || !(PD_KINDS.has(b.kind) || (PD.heavy && b.kind==='eoval'))) continue; const q = (b.x-wx)**2 + (b.y-wy)**2; if (q < bd){ bd = q; best = b; } }
    if (best && spend(PD.en)){ sfx('pd'); best.dead = true; d.cd = PD.cd/LV(d.t); G.beams.push({x1:wx, y1:wy, x2:best.x, y2:best.y, life:.09, max:.09}); }
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
  for (const e of enemies){
    if (e.craft){ updateECraft(e, dt, allies); continue; }
    const dx = p.x-e.x, dy = p.y-e.y;
    // turn the side with the most guns that bear toward the player, re-checked as guns are lost
    if (!e.station && G.time >= (e.bsT || 0)){ e.bside = broadside(e); e.bsT = G.time + 2; }
    const want = Math.atan2(dx,-dy) - ((e.bside ?? FA[0]) - FA[0]);
    // aimed guns switch to a hangar craft that comes much closer than the player
    let td = Math.hypot(dx,dy)*.6; e.tgt = p;
    for (const A of allies){ const d = Math.hypot(A.x-e.x, A.y-e.y); if (A.alive && d < td){ td = d; e.tgt = A; } }
    if (e.station) e.a += .03*e.spin*dt; // starbases turn slowly in place
    else {
      e.a += clamp(angDiff(want,e.a), -e.turn*dt, e.turn*dt);
      e.orb += e.orbSpd*dt;
      const tx = clamp(p.x + Math.cos(e.orb)*e.pref, 0, G.AW), ty = clamp(p.y + Math.sin(e.orb)*e.pref, 0, G.AH);
      const ex = tx-e.x, ey = ty-e.y, el = Math.hypot(ex,ey) || 1, v = Math.min(e.vmax*e.sc, el*1.2);
      e.vx += (ex/el*v - e.vx)*Math.min(1,dt*1.4); e.vy += (ey/el*v - e.vy)*Math.min(1,dt*1.4);
      e.x += e.vx*dt; e.y += e.vy*dt;
    }
    // ramming: ships under a third of the player's size break up on the hull
    if (p.alive && e.r < p.r*.35 && Math.hypot(dx,dy) < p.r + e.r){
      const k = hitShip(p, e.x, e.y, e.r*.5);
      if (k >= 0){ damage(p, k, 1 + e.blocks.size*.4); G.shake = Math.max(G.shake, 2); sfx('ram'); killShip(e); continue; }
    }
    if (p.alive) enemyFire(e, dt*e.fireMul);
    // point defense: shoots down the player's missiles and MIRV warheads
    for (const d of e.epd){
      if ((d.jam || 0) > G.time) continue;
      d.cd = (d.cd ?? rand(0,.6)) - dt; if (d.cd > 0) continue;
      const [wx,wy] = wpos(e,d), R = 75*e.sc;
      let best: typeof G.pb[number] | null = null, bd = R*R;
      for (const b of G.pb){ if (b.dead || !b.homing) continue; const q = (b.x-wx)**2 + (b.y-wy)**2; if (q < bd){ bd = q; best = b; } }
      if (best){ best.dead = true; d.cd = .75; G.beams.push({x1:wx, y1:wy, x2:best.x, y2:best.y, life:.09, max:.09, kind:'epd'}); boomAt(best.x, best.y, 4*SC, .12); }
      else d.cd = .1;
    }
    for (const sb of e.shields){
      const B = sb.bub!;
      if (B.down > 0) B.down -= dt; else if (G.time - B.last > ESH.delay) B.hp = Math.min(B.max, B.hp + ESH.regen*e.hpMul*dt);
    }
    // carriers fly the player's fighters and bombers: one craft per bay at a time, a new one some time after it is lost
    if (e.bays.length && p.alive) for (const b of e.bays){
      if ((b.craft && b.craft.alive) || (b.jam || 0) > G.time) continue;
      b.bt = (b.bt ?? rand(2,5)) - dt;
      if (b.bt <= 0 && G.ships.filter(x => x.alive && x.craft).length < craftCap()){ b.bt = 14; b.craft = launchECraft(e, b); }
    }
  }
  for (let a=0; a<enemies.length; a++) for (let b=a+1; b<enemies.length; b++){
    const A = enemies[a], B = enemies[b]; if (A.craft || B.craft) continue;
    const dx = B.x-A.x, dy = B.y-A.y, d = Math.hypot(dx,dy) || 1, min = (A.r+B.r)*.95;
    // a starbase never gets pushed; whoever bumps it moves the whole way
    if (d < min){ const push = (min-d)*.5*Math.min(1,dt*6), wa = A.station ? 0 : B.station ? 2 : 1, wb = 2 - wa; A.x -= dx/d*push*wa; A.y -= dy/d*push*wa; B.x += dx/d*push*wb; B.y += dy/d*push*wb; }
  }

  // bullets
  const mX = 150*G.S;
  for (const b of G.pb){
    if (b.dead) continue;
    if (b.kind==='mine'){ const f = Math.pow(.35, dt); b.vx *= f; b.vy *= f; }
    if (b.homing){
      if (!b.target || !b.target.alive){ let bd = 1e18; b.target = null; for (const e of enemies){ const d = (e.x-b.x)**2 + (e.y-b.y)**2; if (d < bd){ bd = d; b.target = e; } } }
      // guidance burns out after 2 s; after that the warhead flies straight
      if (b.target && b.life > 4){
        const cur = Math.atan2(b.vy,b.vx), want = Math.atan2(b.target.y-b.y, b.target.x-b.x);
        const na = cur + clamp(angDiff(want,cur), -1.5*dt, 1.5*dt);
        b.vx = Math.cos(na)*b.sp; b.vy = Math.sin(na)*b.sp;
      }
      if (b.tr){ b.tr.push(b.x, b.y); if (b.tr.length > 36) b.tr.splice(0, 2); }
      if (b.mirv && ((b.life0 || 0) - b.life > .8 || (b.target && Math.hypot(b.target.x-b.x, b.target.y-b.y) < b.target.r + 90*SC))){ mirvSplit(b, enemies); continue; }
      if (Math.random() < .18) G.fx.push({k:'smoke', x:b.x, y:b.y, vx:rand(-6,6)*SC, vy:rand(-6,6)*SC, r:2.2*SC, life:rand(.5,.9), max:.9});
    }
    const steps = Math.min(3, Math.ceil(b.sp*dt/(BS*.8)));
    for (let s=0; s<steps && !b.dead; s++){
      b.x += b.vx*dt/steps; b.y += b.vy*dt/steps;
      for (const e of enemies){
        if (!e.alive) continue;
        if (e.shields.length && shieldBlock(e,b)){ b.dead = true; break; }
        const burst = b.kind==='flak' || b.kind==='mine', k = hitShip(e,b.x,b.y,burst ? b.fuse || 0 : b.r);
        if (k >= 0 && burst){ flakBurst(b); break; }
        if (k >= 0){
          const hb = e.blocks.get(k)!; b.dmg *= fallOff(b); damage(e,k,b.dmg); b.dead = true; if (b.kind==='oval') impact(b,e,k, b.r < 3.5*G.SC); if (b.homing) missileBlast(b,e,k);
          if (b.kind==='torp'){ missileBlast(b,e,k); impact(b,e,k); }
          if (b.ion){ ionJam(e, hb); sparks(b.x, b.y, 0, 8, 140*SC, ['#a070ff','#e8dcff','#ffffff']); } G.fx.push({k:'spk', x:b.x, y:b.y, vx:-b.vx*.1, vy:-b.vy*.1, life:.18, max:.18, col:'#ffffff'}); break; }
      }
    }
    b.life -= dt;
    if ((b.kind==='flak' || b.kind==='mine') && !b.dead && b.life <= 0) flakBurst(b);
    if (b.life <= 0 || b.x < -mX || b.y < -mX || b.x > G.AW+mX || b.y > G.AH+mX) b.dead = true;
  }
  for (const b of G.eb){
    if (b.dead) continue;
    if (b.kind==='emiss'){
      // enemy missiles home for 2 s like the player's
      const t = b.tgt && b.tgt.alive ? b.tgt : p;
      if (b.life > 6){
        const cur = Math.atan2(b.vy,b.vx), na = cur + clamp(angDiff(Math.atan2(t.y-b.y, t.x-b.x), cur), -1.5*dt, 1.5*dt);
        b.vx = Math.cos(na)*b.sp; b.vy = Math.sin(na)*b.sp;
      }
      if (b.tr){ b.tr.push(b.x, b.y); if (b.tr.length > 24) b.tr.splice(0, 2); }
    }
    if (b.kind==='eflak'){
      // flak bursts when it comes near a hull or runs out of fuse
      let near = b.life <= dt;
      for (const s of G.ships) if (!near && s.alive && s.team!=='e' && hitShip(s, b.x, b.y, b.fuse || 0) >= 0) near = true;
      if (near){ eBurst(b); continue; }
    }
    const steps = b.sp*dt > 6 ? 2 : 1;
    for (let s=0; s<steps && !b.dead; s++){
      b.x += b.vx*dt/steps; b.y += b.vy*dt/steps;
      if (p.alive){
        if (shieldBlock(p,b)){ b.dead = true; break; }
        const k = hitShip(p,b.x,b.y,b.r);
        if (k >= 0){
          b.dmg *= fallOff(b); damage(p,k,b.dmg); sfx('hit'); b.dead = true; G.fx.push({k:'spk', x:b.x, y:b.y, vx:0, vy:0, life:.2, max:.2, col:BCOL[b.kind]});
          if (b.kind==='snipe') boomAt(b.x,b.y,8*SC,.2);
          if (b.kind==='eoval'){ if (p.alive) for (const d of NB) if (p.blocks.has(k+d)) damage(p, k+d, b.dmg*.4); boomAt(b.x,b.y,9*SC,.2); }
          if (b.kind==='emiss'){ blastShip(p, b.x, b.y, 1.6*BS, b.dmg*.6); boomAt(b.x,b.y,16*SC,.35); sfx('boom', .6); }
          break;
        }
      }
      for (const A of allies){
        const k = A.alive ? hitShip(A,b.x,b.y,b.r) : -1;
        if (k >= 0){ damage(A,k,b.dmg); b.dead = true; G.fx.push({k:'spk', x:b.x, y:b.y, vx:0, vy:0, life:.2, max:.2, col:BCOL[b.kind]}); break; }
      }
    }
    b.life -= dt;
    if (b.life <= 0 || b.x < -mX || b.y < -mX || b.x > G.AW+mX || b.y > G.AH+mX) b.dead = true;
  }
  G.pb = G.pb.filter(b => !b.dead); G.eb = G.eb.filter(b => !b.dead);
  G.ships = G.ships.filter(s => s.alive || s===p);

  updateFx(dt);

  // zoom-out animation: ease in and out over 4 s
  if (G.spanAt < 1){ G.spanAt = Math.min(1, G.spanAt + dt/4); const k = G.spanAt*G.spanAt*(3 - 2*G.spanAt); G.span = G.span0 + (G.spanT - G.span0)*k; }

  // camera: follows the player at the stage's base view; off-screen hostiles get edge arrows
  G.fit = G.span;
  G.camX = p.x; G.camY = p.y;

  // at gates and flagships a swarm keeps coming between and during waves; it never holds up a win
  if (p.alive && (G.fight==='gate' || G.fight==='boss' || G.fight==='station') && G.waveIdx > 0){
    G.swarmT -= dt;
    if (G.swarmT <= 0){ G.swarmT = 12; if (enemies.filter(e => e.alive && e.fodder).length < fodderCap()) spawnSwarm(); }
  }

  // waves
  if (!p.alive){ G.deadT -= dt; if (G.deadT <= 0) playerDied(); }
  else if (!arriving && !enemies.some(e => e.alive && !e.fodder)){
    G.waveGap -= dt;
    if (G.waveGap <= 0){
      if (G.waveIdx < G.waves.length){ G.waveIdx++; spawnWave(G.waves[G.waveIdx-1]); G.waveGap = 1.6; }
      else fightWon();
    }
  }
}
