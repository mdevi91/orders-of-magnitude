import { sfx } from './audio';
import { ESH, T, def, shRad } from './catalog';
import { BS, clamp, rand } from './grid';
import { boomAt, damage, sparks, wpos } from './ships';
import { G } from './state';
import type { BlockType, Bullet, BulletKind, GunDef, Key, Ship } from './types';
import { REDUCE } from './view';

// ---------- bullets ----------
// Flak burst: falls off from the centre, hits every enemy block in range and clears enemy bullets caught in it.
export function flakBurst(b: Bullet){
  const blast = b.blast || 0;
  b.dead = true; boomAt(b.x, b.y, blast*.55, .25); sfx('boom', .5);
  sparks(b.x, b.y, 0, 8, 160*G.SC, ['#ff9a3a','#ffe08a','#ffffff']);
  for (const e of G.ships){
    if (!e.alive || e.team!=='e' || Math.hypot(e.x-b.x, e.y-b.y) > e.r + blast) continue;
    for (const [k,bb] of [...e.blocks]){
      if (!e.alive || !e.blocks.has(k)) continue;
      const [wx,wy] = wpos(e,bb), d = Math.hypot(wx-b.x, wy-b.y);
      if (d < blast) damage(e, k, b.dmg*(1 - .6*d/blast));
    }
  }
  for (const x of G.eb) if (!x.dead && Math.hypot(x.x-b.x, x.y-b.y) < blast) x.dead = true;
}
// Missile warhead: wide blast that hits every block within 1.6 cells of the impact, falling off from the centre.
export function missileBlast(b: Bullet, e: Ship, k: Key){
  const SC = G.SC, rad = 1.6*BS, x = b.x, y = b.y;
  for (const [kk,bb] of [...e.blocks]){
    if (!e.alive || kk===k || !e.blocks.has(kk)) continue;
    const [wx,wy] = wpos(e,bb), d = Math.hypot(wx-x, wy-y);
    if (d < rad + BS*.5) damage(e, kk, b.dmg*.6*(1 - .5*d/(rad + BS*.5)));
  }
  boomAt(x, y, 20*SC, .4); sfx('boom', .8);
  sparks(x, y, Math.atan2(-b.vy,-b.vx), 14, 260*SC, ['#ffffff','#ffe08a','#ff8a4a']);
  for (let n=0; n<4; n++) G.fx.push({k:'smoke', x:x + rand(-6,6)*SC, y:y + rand(-6,6)*SC, vx:rand(-14,14)*SC, vy:rand(-14,14)*SC, r:rand(6,11)*SC, life:rand(.7,1.2), max:1.2});
  if (!REDUCE) G.shake = Math.min(4, G.shake + 1.4);
}
// MIRV carrier: splits into homing warheads fanned out around its heading, spread over the nearest enemies.
export function mirvSplit(b: Bullet, enemies: Ship[]){
  b.dead = true; boomAt(b.x, b.y, 8*G.SC, .15); sfx('missile', .8);
  const ts = [...enemies].filter(e => e.alive).sort((p,q) => Math.hypot(p.x-b.x,p.y-b.y) - Math.hypot(q.x-b.x,q.y-b.y)).slice(0,3);
  const head = Math.atan2(b.vy,b.vx), sub: GunDef = {spd:T.mirv.gun!.spd*1.4, r:2.2, dmg:0, homing:true, cd:0, spread:0};
  const n = b.mirv || 0;
  for (let q=0; q<n; q++){
    pBullet(b.x, b.y, head + (q - (n-1)/2)*.45, sub, ts.length ? ts[q % ts.length] : null);
    G.pb[G.pb.length-1].dmg = b.dmg;
  }
}
// Shots keep full damage over the first half of their range, then fade to half at the end of it.
export const fallOff = (b: Pick<Bullet, 'fall' | 'life' | 'life0'>) => b.fall ? 1 - .5*clamp((1 - b.life/b.life0!)*2 - 1, 0, 1) : 1;
// Reach of a weapon in world units at scale 1 (times G.SC in a fight)
export const rangeOf = (t: BlockType) => { const d = def(t); return !d ? 0 : d.gun ? d.gun.range || 0 : d.laser ? d.laser.range : d.rail ? d.rail.range : d.tesla ? d.tesla.range : 0; };
export function pBullet(x: number, y: number, ang: number, gun: GunDef, target: Ship | null, mul=1){
  const sp = gun.spd*G.SC, life = gun.homing ? 6 : gun.life || (gun.range ? gun.range/gun.spd : 3);
  G.pb.push({x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, sp, r:gun.r*G.SC, dmg:gun.dmg*mul, ion:!!gun.ion, fuse:(gun.fuse||0)*G.SC, blast:(gun.blast||0)*G.SC,
    life, life0:life, fall:!!gun.range && !gun.homing && !gun.lob && !gun.nofall, homing:!!gun.homing, tr:gun.homing ? [] : null, target, mirv:gun.mirv || 0,
    kind:gun.mirv ? 'mirv' : gun.homing ? 'miss' : gun.fx || 'shot'});
}
// every enemy shot flies this much faster than its base speed
export const EB_SPD = 1.2;
// what point defense can shoot down: light or guided rounds only
export const PD_KINDS = new Set<BulletKind>(['emiss','egat','eflak']);
export function eBullet(x: number, y: number, ang: number, mul: number, kind: BulletKind, dmg=10, rMul=1): Bullet | null {
  sfx('eshot');
  if (G.eb.length > 300) return null;
  const sp = 110*EB_SPD*G.SC*mul, b: Bullet = {x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, sp, r:3.4*G.SC*rMul, dmg, life:5.5, kind};
  G.eb.push(b); return b;
}
// Where to shoot so a bullet of speed sp meets the player, assuming the player keeps its velocity.
export function leadAngle(wx: number, wy: number, sp: number, amount: number, p = G.player!){
  const d = Math.hypot(p.x-wx, p.y-wy), t = d/(sp*EB_SPD)*amount;
  return Math.atan2(p.y + p.vy*t - wy, p.x + p.vx*t - wx);
}
// A shield bubble stops an enemy shot heading inward once it is inside the bubble. Returns true when absorbed.
export function shieldBlock(p: Ship, b: Bullet){
  const SH = p.team==='p' ? T.shield.sh! : ESH, rad = p.team==='p' ? shRad() : ESH.rad;
  for (const s of p.shields){
    const B = s.bub!; if (B.down > 0 || B.hp <= 0) continue;
    const [cx,cy] = wpos(p,s), dx = b.x-cx, dy = b.y-cy;
    if (dx*dx + dy*dy > (rad + b.r)**2 || dx*b.vx + dy*b.vy > 0) continue;
    B.hp -= b.dmg*(b.ion ? 5 : 1); B.last = B.flash = G.time; sfx('shield', p.team==='p' ? 1 : .5);
    sparks(b.x, b.y, Math.atan2(dy,dx), 4, 120*G.SC, ['#5fd3ff','#ffffff']);
    if (B.hp <= 0){ sfx('pop'); B.hp = 0; B.down = SH.down; G.fx.push({k:'ring', x:cx, y:cy, r:rad*1.1, life:.5, max:.5, col:p.team==='p' ? '#5fd3ff' : '#ff9a5a'}); }
    return true;
  }
  return false;
}
