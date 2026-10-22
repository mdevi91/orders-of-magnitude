// @ts-nocheck
import { sfx } from './audio';
import { COL, CRAFT, ESH, ET, EW, LV, PARTS, T, pickWeapon } from './catalog';
import { BS, CORE, K, KI, KJ, NB, rand } from './grid';
import { laneFwd, partComplete, physics } from './physics';
import { metaLv } from './runs';
import { G } from './state';
import { keys } from './update';
import { REDUCE } from './view';

// ---------- ships ----------
export function makeShip(design, team, x, y, hpMul=1, dirs=null){
  const s = {team, x, y, vx:0, vy:0, a:0, c:1, sn:0, blocks:new Map(), alive:true, hpMul};
  for (const [k,t] of design){
    const hp = (team==='e' ? ET[t].hp : T[t].hp*LV(t)*(team==='p' && t==='core' ? 1 + .25*metaLv('core') : 1)) * hpMul;
    const b = {t, i:KI(k), j:KJ(k), o:dirs ? dirs.get(k)||0 : 0, hp, max:hp, cd:Math.random()*.4, hit:-1};
    s.blocks.set(k, b);
  }
  recalc(s); return s;
}
export function recalc(s){
  let r = 0; s.guns = []; s.pds = []; s.rails = []; s.lasers = []; s.shields = []; s.bays = []; s.epd = []; s.teslas = [];
  for (const b of s.blocks.values()) r = Math.max(r, Math.hypot(b.i,b.j)*BS + BS*.75);
  s.r = r;
  if (s.team==='a') return; // hangar craft fly and shoot from updateCraft
  if (s.team !== 'p'){
    // enemies: guns, shield bubbles, carrier bays; each generator speeds up their fire
    let gens = 0;
    for (const b of s.blocks.values()){
      if (EW[b.t]) s.guns.push(b); else if (b.t==='bay') s.bays.push(b); else if (b.t==='gen') gens++; else if (b.t==='pd') s.epd.push(b);
      else if (b.t==='shield'){ s.shields.push(b); if (!b.bub){ const max = ESH.hp*s.hpMul; b.bub = {hp:max, max, down:0, last:-9, flash:-9}; } }
    }
    s.fireMul = 1 + .2*Math.min(gens, 2); return;
  }
  const typeAt = k => s.blocks.get(k)?.t;
  s.ph = physics(s.blocks.values(), typeAt);
  for (const b of s.blocks.values()){
    const d = T[b.t];
    // a MIRV fires only while its whole launcher is intact
    if (d.gun && !(PARTS[b.t] && !partComplete(typeAt, b.i, b.j, b.t, b.o))) s.guns.push(b);
    if (d.pd) s.pds.push(b);
    if (d.tesla) s.teslas.push(b);
    if (b.t==='shield') s.shields.push(b);
    if (PARTS[b.t] && !d.gun && partComplete(typeAt, b.i, b.j, b.t, b.o)){
      if (CRAFT[b.t]){ s.bays.push(b); if (b.bt == null) b.bt = 1.5; continue; }
      b.lane = laneFwd(typeAt, b.i, b.j, b.o);
      (b.t==='rail' ? s.rails : s.lasers).push(b);
    }
  }
  // energy: the core gives a little; generators add recharge, batteries add storage
  let cap = 40, regen = 6;
  for (const b of s.blocks.values()){ if (b.t==='gen') regen += T.gen.en.regen*LV('gen'); if (b.t==='battery') cap += T.battery.en.cap*LV('battery'); }
  s.enMax = cap; s.enRegen = regen; s.en = Math.min(s.en ?? cap, cap);
  // each shield block keeps its own bubble state
  for (const b of s.shields) if (!b.bub){ const max = T.shield.sh.hp*LV('shield'); b.bub = {hp:max, max, down:0, last:-9, flash:-9}; }
}
export function genDesign(n, boss, stage, maxGuns=99){
  const d = new Map([[CORE,'core']]), keys = [CORE];
  const pa = Math.min(.3, .08 + .025*stage), pg = boss ? .12 : .15;
  let tries = 0;
  while (d.size < n && tries++ < n*30){
    const base = keys[(Math.random()*keys.length)|0];
    const nk = base + NB[(Math.random()*4)|0];
    if (d.has(nk)) continue;
    const i = KI(nk), j = KJ(nk);
    if (Math.abs(i) > 40 || Math.abs(j) > 40) continue;
    const r = Math.random(), t = r < pg ? pickWeapon(stage) : r < pg+pa ? 'armor' : 'hull';
    d.set(nk,t); keys.push(nk);
    if (i !== 0){ const mk = K(-i,j); if (!d.has(mk)){ d.set(mk,t); keys.push(mk); } }
  }
  if (![...d.values()].some(t => EW[t])) d.set(keys[1] ?? K(0,-1), pickWeapon(stage));
  // later stages fit enemies with the player's systems: shields, generators (buried inside) and carrier bays (on the rim)
  if (d.size >= 8){
    const nbs = k => NB.filter(o => d.has(k+o)).length;
    const conv = (t, count, inner) => {
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
  let guns = [...d.keys()].filter(k => EW[d.get(k)]);
  while (guns.length > Math.max(1, maxGuns)){
    const k = guns[(Math.random()*guns.length)|0], mk = K(-KI(k), KJ(k));
    d.set(k,'armor'); if (EW[d.get(mk)] && guns.length > maxGuns + 1) d.set(mk,'armor');
    guns = guns.filter(g => EW[d.get(g)]);
  }
  return d;
}
export function wpos(s,b){ const lx=b.i*BS, ly=b.j*BS; return [s.x + lx*s.c - ly*s.sn, s.y + lx*s.sn + ly*s.c]; }
export function hitShip(s,x,y,r){
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
export function laneClear(s,b,worldAng){
  const la = worldAng - s.a, dx = Math.cos(la), dy = Math.sin(la), maxT = s.r/BS + 1;
  for (let t=.7; t<maxT; t+=.45){
    const ci = Math.round(b.i + dx*t), cj = Math.round(b.j + dy*t);
    if ((ci!==b.i || cj!==b.j) && s.blocks.has(K(ci,cj))) return false;
  }
  return true;
}
// Enemy blocks along a ray, nearest first. With first=true only the nearest block per ship is kept.
export function rayHits(ox,oy,dx,dy,len,first){
  const out = [];
  for (const e of G.ships){
    if (!e.alive || e.team!=='e') continue;
    const rx = e.x-ox, ry = e.y-oy, t = rx*dx + ry*dy;
    if (t < -e.r || t - e.r > len) continue;
    if (Math.abs(rx*dy - ry*dx) > e.r) continue;
    const seen = new Set();
    for (let q = Math.max(0, t-e.r); q <= Math.min(len, t+e.r); q += BS*.4){
      const k = hitShip(e, ox+dx*q, oy+dy*q, .1);
      if (k >= 0 && !seen.has(k)){ seen.add(k); out.push({e, k, t:q}); if (first) break; }
    }
  }
  out.sort((a,b) => a.t-b.t);
  return first ? out.slice(0,1) : out;
}
export function damage(s,k,dmg){
  const b = s.blocks.get(k); if (!b) return;
  b.hp -= dmg; b.hit = G.time;
  if (b.hp <= 0) destroyBlock(s,k,b);
}
export function destroyBlock(s,k,b){
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
  while (q.length){ const c = q.pop(); for (const d of NB){ const n = c+d; if (s.blocks.has(n) && !seen.has(n)){ seen.add(n); q.push(n); } } }
  for (const [kk,bb] of s.blocks) if (!seen.has(kk)){ s.blocks.delete(kk); debris(s,bb,false); }
  recalc(s);
}
export function killShip(s){
  s.alive = false;
  for (const b of s.blocks.values()) debris(s,b,false,1.6);
  s.blocks.clear();
  G.fx.push({k:'ring', x:s.x, y:s.y, r:s.r*1.8 + 20*G.SC, life:.7, max:.7, col:s.team==='p' ? '#ffffff' : '#ff9a7a'});
  if (s.team==='e'){
    sfx(s.boss ? 'big' : 'boom', Math.min(1.5, .4 + s.r/60));
    G.credits += s.value; G.earned += s.value; G.stats.kills++;
    G.fx.push({k:'txt', x:s.x, y:s.y, vy:-30*G.SC, text:'+'+s.value, life:1.4, max:1.4});
  } else if (s.team==='p'){ G.deadT = 1.6; sfx('die'); }
  else sfx('boom', .6);
}
export function debris(s,b,burst,kick=1){
  if (G.fx.length > 1800) return;
  const [x,y] = wpos(s,b), v = 70*G.SC*kick;
  G.fx.push({k:'deb', x, y, vx:s.vx*.5 + rand(-v,v), vy:s.vy*.5 + rand(-v,v), a:s.a, va:rand(-4,4), life:rand(1,2.2), max:2.2, col:COL[s.team][b.t]});
  if (burst) for (let n=0; n<4; n++) G.fx.push({k:'spk', x, y, vx:rand(-1,1)*160*G.SC, vy:rand(-1,1)*160*G.SC, life:rand(.15,.4), max:.4, col:'#ffffff'});
}
export function boomAt(x,y,r,life){ G.fx.push({k:'boom', x, y, r, life, max:life}); }
export function sparks(x,y,ang,n,spd,cols){
  for (let q=0; q<n; q++){
    const a = ang + rand(-1.3,1.3), v = rand(.3,1)*spd;
    G.fx.push({k:'spk', x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:rand(.25,.6), max:.6, col:cols[q % cols.length]});
  }
}
// Cannon shell hit: splash onto neighbouring blocks, knockback, fireball, flying sparks, smoke, screen shake.
export function impact(b,e,k){
  const SC = G.SC, ang = Math.atan2(b.vy,b.vx), x = b.x, y = b.y;
  if (e.alive) for (const d of NB) if (e.blocks.has(k+d)) damage(e, k+d, b.dmg*.4);
  const kick = 55*SC/Math.sqrt(e.blocks.size + 1);
  e.vx += Math.cos(ang)*kick; e.vy += Math.sin(ang)*kick;
  boomAt(x, y, 13*SC, .24);
  sparks(x, y, ang+Math.PI, 12, 300*SC, ['#ffffff','#ffd27a','#ff8a4a']);
  for (let n=0; n<3; n++) G.fx.push({k:'smoke', x:x + rand(-4,4)*SC, y:y + rand(-4,4)*SC, vx:rand(-12,12)*SC + e.vx*.4, vy:rand(-12,12)*SC + e.vy*.4, r:rand(5,9)*SC, life:rand(.6,1.1), max:1.1});
  if (!REDUCE) G.shake = Math.min(4, G.shake + 1.6);
}
