import { BCOL, BEAM, ESH, GCOL, MAXLV, T, def, grpOf, isWeapon, lvOf, shRad } from './catalog';
import { rangeOf } from './bullets';
import { cellsFor, placeCheck, placeSpots } from './editor';
import { BS, FA, FACE, K, KI, KJ, TAU, angDiff, clamp, rand } from './grid';
import { laneFwd } from './physics';
import { wpos } from './ships';
import { G, buildR, spanFor } from './state';
import { JOY_R } from './update';
import type { BlockType, Bullet, BulletKind, Cell, Facing, Key, Ship, Stick, Team } from './types';
import { $, DPR, FONT, H, PX, W, ctx, hctx } from './view';

// ---------- drawing ----------
// VGA-style metal sprites: each block is a bevelled plate (light top-left, shadow bottom-right) with its part drawn on top.
// Palettes are [highlight, base, shadow].
type Ctx = CanvasRenderingContext2D;
/** [highlight, base, shadow] */
type Pal3 = [string, string, string];
export const MET: Record<'p'|'e', {hull: Pal3; armor: Pal3; dark: Pal3}> = {
  p:{hull:['#d4dbe6','#8590a1','#454c5a'], armor:['#b4bcc8','#5f6878','#2b3039'], dark:['#7d8796','#3d4350','#1c1f26']},
  e:{hull:['#e08a62','#9a4630','#4a1c12'], armor:['#b8705a','#6a3024','#30120c'], dark:['#8a4a3a','#4a2018','#200a06']},
};
export function plate(X: Ctx, x: number, y: number, m: Pal3){
  X.fillStyle = m[1]; X.fillRect(x-5,y-5,10,10);
  X.fillStyle = m[0]; X.fillRect(x-5,y-5,10,1.3); X.fillRect(x-5,y-5,1.3,10);
  X.fillStyle = m[2]; X.fillRect(x-5,y+3.7,10,1.3); X.fillRect(x+3.7,y-5,1.3,10);
}
export function orb(X: Ctx, x: number, y: number, r: number, cols: string[]){ for (let n=0; n<cols.length; n++){ X.fillStyle = cols[n]; X.beginPath(); X.arc(x - n*r*.12, y - n*r*.12, r*(1 - n/cols.length), 0, TAU); X.fill(); } }
export function barrel(X: Ctx, x: number, y: number, ca: number, sa: number, len: number, w: number, m: Pal3){
  const px = -sa*w/2, py = ca*w/2;
  X.fillStyle = m[2]; X.beginPath(); X.moveTo(x+px,y+py); X.lineTo(x+px+ca*len,y+py+sa*len); X.lineTo(x-px+ca*len,y-py+sa*len); X.lineTo(x-px,y-py); X.closePath(); X.fill();
  X.fillStyle = m[0]; X.beginPath(); X.moveTo(x+px*.3,y+py*.3); X.lineTo(x+px*.3+ca*len,y+py*.3+sa*len); X.lineTo(x-px*.4+ca*len,y-py*.4+sa*len); X.lineTo(x-px*.4,y-py*.4); X.closePath(); X.fill();
}
export function drawBlock(X: Ctx, t: Cell, o: Facing, team: Team, x: number, y: number, aim: number, hit: boolean, ratio: number, firing?: boolean){
  const M = MET[team==='e' ? 'e' : 'p'], bx = x, by = y;
  if (t==='sell'){
    X.fillStyle = '#ff3d2a'; X.save(); X.translate(x,y); X.rotate(Math.PI/4); X.fillRect(-5,-1.2,10,2.4); X.fillRect(-1.2,-5,2.4,10); X.restore(); return;
  }
  const base = t==='armor' ? M.armor : t==='hull' ? M.hull : M.dark;
  plate(X,x,y,base);
  if (hit){ X.fillStyle = '#ffffff'; X.globalAlpha = .85; X.fillRect(x-5,y-5,10,10); X.globalAlpha = 1; return; }
  const d = def(t), rot = o ? o*Math.PI/4 : 0;
  if (rot){ X.save(); X.translate(x,y); X.rotate(rot); x = 0; y = 0; }
  let ang = aim - rot;
  const arc = team==='p' && d && d.gun ? d.gun.arc || 0 : 0;
  if (arc) ang = -Math.PI/2 + clamp(angDiff(ang,-Math.PI/2), -arc, arc);
  const ca = Math.cos(ang), sa = Math.sin(ang), gun: Pal3 = team!=='e' ? ['#e8eef6','#9aa4b4','#2a2e36'] : ['#ffd08a','#c8783a','#4a2010'];
  switch (t as string){
    case 'hull':
      X.fillStyle = base[2]; X.fillRect(x-.5,y-3,1,6); break;
    case 'armor':
      X.fillStyle = base[2]; X.fillRect(x-3,y-3,6,6); X.fillStyle = base[0]; X.fillRect(x-3,y-3,5,1); X.fillRect(x-3,y-3,1,5);
      X.fillStyle = base[0]; for (const [a,b] of [[-3.4,-3.4],[2.6,-3.4],[-3.4,2.6],[2.6,2.6]]) X.fillRect(x+a,y+b,.9,.9); break;
    case 'core':
      orb(X,x,y,4.2, team==='p' ? ['#0a3a6a','#1a8ad0','#5fd8ff','#e8ffff'] : ['#5a1008','#c0301a','#ff8a5a','#fff0d0']);
      X.globalAlpha = .25 + .2*Math.sin(G.time*6); X.fillStyle = '#ffffff'; X.beginPath(); X.arc(x,y,4.6,0,TAU); X.fill(); X.globalAlpha = 1; break;
    case 'cannon': case 'gun':
      barrel(X,x,y,ca,sa,7,2.4,gun); orb(X,x,y,3, [gun[2],gun[1],gun[0]]); break;
    case 'bigcannon':
      barrel(X,x,y,ca,sa,9,3.6,gun); orb(X,x,y,4, [gun[2],gun[1],gun[0]]);
      X.fillStyle = gun[2]; X.fillRect(x-.8,y-.8,1.6,1.6); break;
    case 'bigcannon_b':
      X.fillStyle = '#20242c'; X.fillRect(x-4,y-4,8,8); X.fillStyle = '#5a6270'; X.fillRect(x-4,y-4,8,1.2); X.fillRect(x-4,y+2.8,8,1.2);
      X.fillStyle = '#a8ecff'; X.fillRect(x-.6,y-2.4,1.2,4.8); break;
    case 'hgatling':
      for (const q of [-1.8,-.6,.6,1.8]) barrel(X,x-sa*q,y+ca*q,ca,sa,7.4,1.1,gun);
      orb(X,x,y,3.2, [gun[2],'#5a6270',gun[1]]); break;
    case 'hgatling_b':
      X.fillStyle = '#20242c'; X.fillRect(x-3.6,y-4,7.2,8); X.fillStyle = '#d8b04a'; for (let q=-3; q<4; q+=1.5) X.fillRect(x-2.6,y+q-.4,5.2,.8);
      break;
    case 'scatter':
      for (const q of [-1,0,1]) barrel(X,x-sa*q*1.6,y+ca*q*1.6,Math.cos(ang+q*.18),Math.sin(ang+q*.18),5.4,1.3,gun);
      orb(X,x,y,2.8, [gun[2],'#6a7280',gun[0]]); break;
    case 'ion':
      barrel(X,x,y,ca,sa,6,2,['#c8f4ff','#3a8ab0','#0a2a3a']); orb(X,x,y,3, ['#0a2a4a','#2a9ad0','#9ae8ff']);
      X.fillStyle = Math.sin(G.time*8) > 0 ? '#ffffff' : '#5fe0ff'; X.fillRect(x-.6,y-.6,1.2,1.2); break;
    case 'tesla': {
      X.fillStyle = '#1a1430'; X.fillRect(x-3.6,y-3.6,7.2,7.2);
      orb(X,x,y,3, ['#2a1a4a','#8a6ae0','#e8dcff']);
      const k = G.time*9 + x;
      X.fillStyle = '#ffffff'; for (let q=0; q<3; q++){ const a = k + q*TAU/3; X.fillRect(x + Math.cos(a)*3.6 - .5, y + Math.sin(a)*3.6 - .5, 1, 1); }
      break;
    }
    case 'torpedo':
      barrel(X,x,y,ca,sa,6.4,3.2,['#ffe8a0','#a07a20','#2a2008']); orb(X,x,y,2.6, ['#2a2008','#a07a20','#ffe08a']); break;
    case 'mine':
      X.fillStyle = '#20242c'; X.fillRect(x-3.6,y-3.6,7.2,7.2);
      for (const [a,b] of [[-1.8,-1.8],[1.8,-1.8],[-1.8,1.8],[1.8,1.8]]){ X.fillStyle = '#ff7a3a'; X.fillRect(x+a-1,y+b-1,2,2); }
      X.fillStyle = Math.sin(G.time*4 + x) > .6 ? '#ffffff' : '#ff3d2a'; X.fillRect(x-.6,y-.6,1.2,1.2); break;
    case 'flak':
      barrel(X,x-sa*1.4,y+ca*1.4,ca,sa,5,1.8,gun); barrel(X,x+sa*1.4,y-ca*1.4,ca,sa,5,1.8,gun);
      orb(X,x,y,3, ['#4a2010','#c8783a','#ffb060']); break;
    case 'gatling':
      barrel(X,x-sa*1.2,y+ca*1.2,ca,sa,6.6,1.2,gun); barrel(X,x+sa*1.2,y-ca*1.2,ca,sa,6.6,1.2,gun);
      orb(X,x,y,2.6, [gun[2],'#5a6270',gun[1]]); break;
    case 'missile':
      X.fillStyle = '#20242c'; X.fillRect(x-3.5,y-3.5,7,7);
      for (const dx of [-1.7,1.7]){ X.fillStyle = '#d8dde6'; X.fillRect(x+dx-.8,y-2.6,1.6,5); X.fillStyle = '#ff3d2a'; X.fillRect(x+dx-.8,y-3.2,1.6,1.4); }
      break;
    case 'mirv':
      X.fillStyle = '#20242c'; X.fillRect(x-3.5,y-3.5,7,7);
      X.fillStyle = '#d8dde6'; X.fillRect(x-1.6,y-2.4,3.2,5.4); X.fillStyle = '#ff7ad8'; X.fillRect(x-1.6,y-3.6,3.2,1.6);
      X.fillStyle = '#ffffff'; X.fillRect(x-.5,y-3.6,1,.8); X.fillStyle = '#5a6270'; X.fillRect(x-3,y+1.6,1.2,1.4); X.fillRect(x+1.8,y+1.6,1.2,1.4);
      break;
    case 'mirv_b':
      X.fillStyle = '#20242c'; X.fillRect(x-4,y-4,8,8); X.fillStyle = '#5a3a50'; X.fillRect(x-3,y-3,2.4,6); X.fillRect(x+.6,y-3,2.4,6);
      X.fillStyle = '#ff7ad8'; X.fillRect(x-3,y-3,2.4,1); X.fillRect(x+.6,y-3,2.4,1); break;
    case 'engine':
      X.fillStyle = '#20242c'; X.fillRect(x-3.6,y-1,7.2,5.2); X.fillStyle = '#5a6270'; X.fillRect(x-3.6,y-1,7.2,1.2);
      X.fillStyle = '#ff7a2a'; X.fillRect(x-2.4,y+3,4.8,1.4);
      if (firing){
        const L = rand(5,10);
        X.fillStyle = '#ff4a1a'; X.beginPath(); X.moveTo(x-3,y+4.6); X.lineTo(x+3,y+4.6); X.lineTo(x,y+4.6+L); X.closePath(); X.fill();
        X.fillStyle = '#ffd04a'; X.beginPath(); X.moveTo(x-1.9,y+4.6); X.lineTo(x+1.9,y+4.6); X.lineTo(x,y+4.6+L*.65); X.closePath(); X.fill();
        X.fillStyle = '#ffffff'; X.beginPath(); X.moveTo(x-.9,y+4.6); X.lineTo(x+.9,y+4.6); X.lineTo(x,y+4.6+L*.3); X.closePath(); X.fill();
      }
      break;
    case 'gyro': {
      orb(X,x,y,3.6, ['#4a3a10','#a8822a','#e8c860']);
      const r = G.time*5, c = Math.cos(r)*3, s = Math.sin(r)*3;
      X.fillStyle = '#fff0b0'; X.fillRect(x+c-.8,y+s-.8,1.6,1.6); X.fillRect(x-c-.8,y-s-.8,1.6,1.6); break;
    }
    case 'rail': case 'rail_b':
      X.fillStyle = '#3a2a5a'; X.fillRect(x-3.4,y-5,2,10); X.fillRect(x+1.4,y-5,2,10);
      X.fillStyle = '#b89aff'; X.fillRect(x-3.4,y-5,.8,10); X.fillRect(x+1.4,y-5,.8,10);
      X.fillStyle = '#7a5aff'; for (let q=-4; q<5; q+=3) X.fillRect(x-1.4,y+q,2.8,1);
      if (t==='rail'){ X.fillStyle = '#ffffff'; X.fillRect(x-1,y-5,2,1.6); }
      break;
    case 'laser':
      barrel(X,x,y,0,-1,5.2,2.2,['#c8ffc0','#3a8a3a','#143a14']); orb(X,x,y,2.8, ['#0a3a0a','#2ac83a','#b8ffb0']); break;
    case 'laser_b':
      X.fillStyle = '#143a14'; X.fillRect(x-3,y-3,6,6); X.fillStyle = '#2ac83a'; X.fillRect(x-2,y-.6,4,1.2); X.fillRect(x-.6,y-2,1.2,4); break;
    case 'shield':
      X.fillStyle = '#0a2a4a'; X.beginPath(); X.arc(x,y+1.5,4,Math.PI,0); X.fill();
      X.fillStyle = '#3fb8ff'; X.beginPath(); X.arc(x,y+1.5,3,Math.PI,0); X.fill();
      X.fillStyle = '#e0f8ff'; X.fillRect(x-.8,y-.2,1.6,1.6); break;
    case 'gen': {
      const k = .5 + .5*Math.sin(G.time*5 + x);
      X.fillStyle = '#3a3010'; X.fillRect(x-3.6,y-3.6,7.2,7.2);
      orb(X,x,y,3, ['#6a4a08','#e0a020', k > .5 ? '#fff0a0' : '#ffd04a']);
      X.fillStyle = '#ffd04a'; X.fillRect(x-4,y-.4,1.2,.8); X.fillRect(x+2.8,y-.4,1.2,.8); X.fillRect(x-.4,y-4,.8,1.2); X.fillRect(x-.4,y+2.8,.8,1.2); break;
    }
    case 'bay': {
      X.fillStyle = '#0a0b0e'; X.fillRect(x-3.6,y-3.6,7.2,7.2);
      const on = Math.sin(G.time*6) > 0;
      X.fillStyle = on ? '#ffd04a' : '#7a5a10'; for (let q=-3; q<4; q+=2.4){ X.fillRect(x-3.6,y+q,1.2,1.2); X.fillRect(x+2.4,y+q,1.2,1.2); }
      break;
    }
    case 'fbay': case 'bbay': {
      // hangar mouth on the fore edge with blinking running lights and a launch chevron
      const lit = t==='fbay' ? '#5fd8ff' : '#ffc46b', on = Math.sin(G.time*5) > 0;
      X.fillStyle = '#0a0b0e'; X.fillRect(x-4,y-5,8,8.4); X.fillStyle = '#20242c'; X.fillRect(x-4,y+3.4,8,1.6);
      X.fillStyle = on ? lit : '#2a3a4a'; X.fillRect(x-4.6,y-4.8,1.2,1.2); X.fillRect(x+3.4,y-4.8,1.2,1.2);
      X.fillStyle = lit; X.fillRect(x-.6,y-2.8,1.2,1.2); X.fillRect(x-1.8,y-1.6,1.2,1.2); X.fillRect(x+.6,y-1.6,1.2,1.2);
      break;
    }
    case 'fbay_b': case 'bbay_b':
      X.fillStyle = '#16191f'; X.fillRect(x-4,y-5,8,10);
      X.fillStyle = t==='fbay_b' ? '#3a8ab0' : '#a07830'; X.fillRect(x-.5,y-3.5,1,2.6); X.fillRect(x-.5,y+1,1,2.6);
      break;
    case 'battery':
      X.fillStyle = '#142a14'; X.fillRect(x-3.6,y-3,7.2,6);
      for (let q=0; q<3; q++){ X.fillStyle = '#3ac84a'; X.fillRect(x-2.9+q*2.2,y-2.3,1.6,4.6); X.fillStyle = '#b8ffb0'; X.fillRect(x-2.9+q*2.2,y-2.3,1.6,.9); }
      X.fillStyle = '#9aa4b4'; X.fillRect(x-1,y-4,2,1); break;
    case 'pd':
      orb(X,x,y,3.2, ['#2a1a4a','#7a4ad0','#d8c0ff']); X.fillStyle = '#ffffff'; X.fillRect(x-.5,y-.5,1,1); break;
  }
  if (rot) X.restore();
  // battle damage: scorch the plate as it loses hit points
  if (ratio < .7){ X.globalAlpha = (1-ratio)*.6; X.fillStyle = '#000000'; X.fillRect(bx-5,by-5,10,10); X.globalAlpha = 1; }
  // level pips: one gold chevron per level above 1, plus a gold trim at max level
  if (team==='p' && d){
    const L = lvOf(t);
    X.fillStyle = '#ffc46b'; for (let q=1; q<L; q++) X.fillRect(bx-4+(q-1)*2.1, by+1.8, 1.6, 1.4);
    if (L >= MAXLV){ X.globalAlpha = .7; X.fillRect(bx-5,by-5,10,.8); X.globalAlpha = 1; }
  }
}
export function drawShip(s: Ship){
  const z = G.zoom, p = G.player!;
  ctx.save();
  ctx.translate((s.x-G.camX)*z + W/2 + (G.camOX||0), (s.y-G.camY)*z + H/2 + (G.camOY||0)); ctx.rotate(s.a); ctx.scale(z,z);
  ctx.lineWidth = 1/z;
  const aim = (s.team==='p' ? Math.atan2(G.aim.y-s.y, G.aim.x-s.x) : s.team==='a' ? s.aimA : Math.atan2(p.y-s.y, p.x-s.x)) - s.a;
  if (s.team==='e'){
    // bright rim around enemy hulls so they stand out in a crowd and against smoke
    const m = 1.5/z;
    ctx.fillStyle = s.boss || s.elite ? '#ffd04a' : '#ff5a3a';
    for (const b of s.blocks.values()) ctx.fillRect(b.i*BS-5-m, b.j*BS-5-m, 10+2*m, 10+2*m);
  }
  for (const b of s.blocks.values())
    drawBlock(ctx, b.t, b.o, s.team, b.i*BS, b.j*BS, aim, G.time-b.hit < .05, b.hp/b.max, b.firing);
  // ion-jammed weapons flicker violet
  for (const b of s.blocks.values()) if ((b.jam || 0) > G.time){
    ctx.globalAlpha = .35 + .3*Math.sin(G.time*40 + b.i*3); ctx.fillStyle = '#a070ff'; ctx.fillRect(b.i*BS-5, b.j*BS-5, 10, 10); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// deep-space backdrop: three parallax star layers and a few nebula clouds, all in screen space
export const STARS = ([[.04,240,'#4a5270'],[.12,110,'#9aa8d0'],[.3,45,'#ffffff']] as const).map(([f,n,c]) =>
  Array.from({length:n}, () => ({x:Math.random(), y:Math.random(), f, c, tw:Math.random()*Math.PI*2})));
export const NEB = [[.2,.3,'60,20,110'],[.75,.6,'10,60,120'],[.5,.95,'110,20,60'],[.95,.1,'20,90,90']] as const;
export function drawSpace(cx: number, cy: number, z: number){
  const wrap = (v: number, m: number) => ((v % m) + m) % m, NW = W*1.6, NH = H*1.6;
  for (const [nx,ny,rgb] of NEB){
    const X = wrap(nx*NW - cx*z*.02, NW) - W*.3, Y = wrap(ny*NH - cy*z*.02, NH) - H*.3, R = Math.max(W,H)*.45;
    const g = ctx.createRadialGradient(X,Y,0,X,Y,R);
    g.addColorStop(0,`rgba(${rgb},.38)`); g.addColorStop(.5,`rgba(${rgb},.14)`); g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(X-R,Y-R,2*R,2*R);
  }
  for (const L of STARS) for (const st of L){
    const X = Math.round(wrap(st.x*W - cx*z*st.f, W)), Y = Math.round(wrap(st.y*H - cy*z*st.f, H));
    ctx.fillStyle = st.c; ctx.fillRect(X,Y,1,1);
    if (st.f > .2 && Math.sin(G.time*2 + st.tw) > .7){ ctx.globalAlpha = .5; ctx.fillRect(X-1,Y,3,1); ctx.fillRect(X,Y-1,1,3); ctx.globalAlpha = 1; }
  }
}
export function niceStep(z: number){ let sp = 10; if (!(z > 0)) return sp; while (sp*z < 12) sp *= 10; return sp; }
export function renderCombat(){
  const S = G.S, p = G.player!;
  // never so far out that a block shrinks under two pixels; off-screen hostiles get edge arrows
  G.zoom = Math.max(.2, Math.min(W,H)/((G.fit || G.span || spanFor(p.r, S))*G.camMul));
  const z = G.zoom, hw = W/2/z, hh = H/2/z;
  let cx = G.camX, cy = G.camY;
  cx = G.AW < 2*hw ? G.AW/2 : clamp(cx, hw, G.AW-hw);
  cy = G.AH < 2*hh ? G.AH/2 : clamp(cy, hh, G.AH-hh);
  G.camX = cx; G.camY = cy;
  const ox = G.shake > .3 ? Math.round(rand(-G.shake,G.shake)) : 0, oy = G.shake > .3 ? Math.round(rand(-G.shake,G.shake)) : 0;
  const sx = (x: number) => (x-cx)*z + W/2 + ox, sy = (y: number) => (y-cy)*z + H/2 + oy;
  G.camOX = ox; G.camOY = oy;

  drawSpace(cx, cy, z);
  const major = niceStep(z);
  // arena edge: faint warning line
  ctx.setLineDash([6,6]); ctx.strokeStyle = 'rgba(255,110,60,.3)'; ctx.lineWidth = 1;
  ctx.strokeRect(sx(0), sy(0), G.AW*z, G.AH*z); ctx.setLineDash([]);

  // enemy railgun sight lines
  ctx.setLineDash([3,3]); ctx.lineWidth = 1;
  for (const s of G.ships){
    if (!s.alive || !s.sights) continue;
    for (const [wx,wy,a] of s.sights){
      const L = 700*G.S;
      ctx.globalAlpha = .5 + .5*Math.sin(G.time*30); ctx.strokeStyle = '#ff3d3d';
      ctx.beginPath(); ctx.moveTo(sx(wx),sy(wy)); ctx.lineTo(sx(wx+Math.cos(a)*L), sy(wy+Math.sin(a)*L)); ctx.stroke();
    }
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;

  // beams: point defense zaps and railgun lines
  for (const b of G.beams){
    const a = b.life/b.max;
    if (b.kind==='rail'){
      ctx.globalAlpha = a; ctx.strokeStyle = '#b9a8f0'; ctx.lineWidth = Math.max(1, Math.round(3*a));
      ctx.beginPath(); ctx.moveTo(sx(b.x1),sy(b.y1)); ctx.lineTo(sx(b.x2),sy(b.y2)); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    } else if (b.kind==='tesla'){
      // lightning: a jagged line that re-rolls every frame
      const x1 = sx(b.x1), y1 = sy(b.y1), x2 = sx(b.x2), y2 = sy(b.y2), len = Math.hypot(x2-x1, y2-y1) || 1, nx = -(y2-y1)/len, ny = (x2-x1)/len;
      ctx.globalAlpha = a; ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x1,y1);
      for (let q=1; q<6; q++){ const f = q/6, j = rand(-1,1)*Math.min(8, len*.12); ctx.lineTo(x1 + (x2-x1)*f + nx*j, y1 + (y2-y1)*f + ny*j); }
      ctx.lineTo(x2,y2); ctx.stroke();
    } else {
      ctx.globalAlpha = a; ctx.strokeStyle = b.kind==='epd' ? '#ff7a66' : '#c9adff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx(b.x1),sy(b.y1)); ctx.lineTo(sx(b.x2),sy(b.y2)); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // smoke and debris sit under the ships so a busy fight does not hide them
  for (const f of G.fx){
    const a = clamp(f.life/f.max, 0, 1);
    if (f.k==='deb'){
      const X = sx(f.x), Y = sy(f.y), h = Math.max(1, 4.5*z); if (X < -20 || Y < -20 || X > W+20 || Y > H+20) continue;
      ctx.save(); ctx.translate(X,Y); ctx.rotate(f.a); ctx.globalAlpha = a; ctx.fillStyle = '#2a2e36'; ctx.fillRect(-h,-h,2*h,2*h); ctx.fillStyle = f.col; ctx.fillRect(-h,-h,2*h-1,2*h-1); ctx.restore();
    } else if (f.k==='smoke'){
      ctx.globalAlpha = a*.35; ctx.fillStyle = '#5a6488';
      ctx.beginPath(); ctx.arc(Math.round(sx(f.x)), Math.round(sy(f.y)), Math.max(1, f.r*z*(1.6-a*.6)), 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // weapon reach: one dashed ring per weapon type on the player's ship, in its group's colour, labelled at the top
  if (p && p.alive){
    const seen = new Set<Cell>();
    ctx.lineWidth = 1; ctx.setLineDash([2,5]); ctx.font = FONT(8); ctx.textAlign = 'center';
    for (const b of [...p.guns, ...p.rails, ...p.lasers, ...p.teslas, ...p.pds]){
      if (seen.has(b.t)) continue; seen.add(b.t);
      const d = def(b.t)!, r = d.pd ? d.pd.range*Math.sqrt(G.S) : rangeOf(b.t as BlockType)*G.SC; if (!r) continue;
      const col = b.t==='core' ? '#ffffff' : d.pd ? '#c9adff' : GCOL[grpOf(K(b.i,b.j), b.t)-1], X = sx(p.x), Y = sy(p.y), rr = r*z;
      ctx.globalAlpha = .28; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(X, Y, rr, 0, TAU); ctx.stroke();
      if (Y - rr > 12){ ctx.globalAlpha = .55; ctx.fillStyle = col; ctx.fillText(d.name, X, Math.round(Y - rr - 3)); }
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  for (const s of G.ships) if (s.alive) drawShip(s);

  // life bars over damaged enemy ships (the capital ship's sits in the HUD)
  for (const e of G.ships){
    if (!e.alive || e.team!=='e' || e === G.boss || e.life >= e.lifeMax) continue;
    const w = Math.max(14, Math.min(60, e.r*z*1.4)), X = Math.round(sx(e.x) - w/2), Y = Math.round(sy(e.y) - e.r*z - 8), k = Math.max(0, e.life/e.lifeMax);
    ctx.fillStyle = '#000000'; ctx.fillRect(X-1, Y-1, w+2, 4);
    ctx.fillStyle = k < .35 ? '#ff5a3a' : '#ffc46b'; ctx.fillRect(X, Y, Math.round(w*k), 2);
  }

  // enemy shield bubbles
  for (const e of G.ships){
    if (!e.alive || e.team!=='e' || !e.shields || !e.shields.length) continue;
    for (const sb of e.shields){
      const B = sb.bub!; if (B.down > 0 || B.hp <= 0) continue;
      const [wx,wy] = wpos(e,sb), fl = G.time - B.flash < .08;
      ctx.globalAlpha = fl ? 1 : .2 + .5*B.hp/B.max; ctx.strokeStyle = fl ? '#ffffff' : '#ff9a5a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx(wx), sy(wy), ESH.rad*z, 0, TAU); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // lasers and shields of the player
  if (p && p.alive){
    for (const h of p.lasers){
      if (!h.beam) continue;
      const [a1,b1,a2,b2] = h.beam;
      ctx.globalAlpha = .35; ctx.strokeStyle = '#9dff8a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx(a1),sy(b1)); ctx.lineTo(sx(a2),sy(b2)); ctx.stroke();
      ctx.globalAlpha = .7 + .3*Math.random(); ctx.strokeStyle = '#eaffe4'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const s of p.shields){
      const B = s.bub!; if (B.down > 0 || B.hp <= 0) continue;
      const [wx,wy] = wpos(p,s), fl = G.time - B.flash < .08, X = sx(wx), Y = sy(wy), r = shRad()*z, k = B.hp/B.max;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fl ? .16 : .04 + .05*k; ctx.fillStyle = '#5fd3ff'; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = fl ? 1 : .25 + .55*k; ctx.strokeStyle = fl ? '#ffffff' : '#5fd3ff'; ctx.lineWidth = fl ? 2 : 1;
      ctx.setLineDash([4,3]); ctx.lineDashOffset = -G.time*12;
      ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 1;
  }

  // explosions and floating text
  for (const f of G.fx){
    const a = clamp(f.life/f.max, 0, 1);
    if (f.k==='boom'){
      // fireball: white core first, then orange, then a fading red rim
      const X = Math.round(sx(f.x)), Y = Math.round(sy(f.y)), r = Math.max(1, f.r*z*(1.25-a*.5));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a*.5; ctx.fillStyle = '#c8300a'; ctx.beginPath(); ctx.arc(X, Y, r*1.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = a > .6 ? '#ffd04a' : a > .3 ? '#ff7a1a' : '#8a1a08';
      ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
      if (a > .3){ ctx.fillStyle = a > .7 ? '#ffffff' : '#fff0a0'; ctx.beginPath(); ctx.arc(X - r*.15, Y - r*.15, r*.55, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (f.k==='ring'){
      ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), Math.max(1, f.r*z*(1.15-a)), 0, TAU); ctx.stroke();
    } else if (f.k==='txt'){
      ctx.globalAlpha = a; ctx.fillStyle = '#ffc46b'; ctx.font = FONT(8); ctx.textAlign = 'center';
      ctx.fillText(f.text, Math.round(sx(f.x)), Math.round(sy(f.y)));
    }
  }
  ctx.globalAlpha = 1;

  // sparks and bullets on top, snapped to whole pixels: coloured block with a white hot centre
  for (const f of G.fx) if (f.k==='spk'){ ctx.globalAlpha = f.life/f.max; ctx.fillStyle = f.col; ctx.fillRect(Math.round(sx(f.x)), Math.round(sy(f.y)), 1, 1); }
  ctx.globalAlpha = 1;
  // enemy rounds share the shape of the player's matching weapon, only the hue differs
  const SHAPE: Partial<Record<BulletKind, BulletKind>> = {eoval:'oval', egat:'line', emiss:'miss', eflak:'flak', snipe:'oval'};
  const drawB = (arr: Bullet[]) => {
    for (const b of arr){
      const k = SHAPE[b.kind] || b.kind;
      const X = Math.round(sx(b.x)), Y = Math.round(sy(b.y)), s = Math.max(1, Math.round(b.r*z));
      if (X < -s*4 || Y < -s*4 || X > W+s*4 || Y > H+s*4) continue;
      if (k!=='line'){ ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3; ctx.fillStyle = BCOL[b.kind]; ctx.beginPath(); ctx.arc(X, Y, s*2.6+1, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (b.tr && b.tr.length > 2){
        // exhaust trail: fades from hot yellow at the missile to dim orange at the tail
        const n = b.tr.length/2; ctx.lineWidth = 1;
        for (let q=1; q<n; q++){
          ctx.globalAlpha = q/n*.9; ctx.strokeStyle = q > n*.6 ? '#ffe08a' : '#ff8a4a';
          ctx.beginPath(); ctx.moveTo(Math.round(sx(b.tr[2*q-2]))+.5, Math.round(sy(b.tr[2*q-1]))+.5); ctx.lineTo(Math.round(sx(b.tr[2*q]))+.5, Math.round(sy(b.tr[2*q+1]))+.5); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (k==='miss' || k==='mirv' || k==='torp'){
        const ang = Math.atan2(b.vy,b.vx), w = k==='mirv' || k==='torp' ? .75 : .5;
        ctx.fillStyle = BCOL[b.kind]; ctx.beginPath(); ctx.ellipse(X, Y, s*2.2, Math.max(.6, s*w), ang, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(X + Math.cos(ang)*s*1.6), Math.round(Y + Math.sin(ang)*s*1.6), 1, 1);
        continue;
      }
      if (k==='ion'){
        // ion bolt: a flickering violet-white orb wrapped in crackling sparks, nothing like a cannon slug
        const R = s*1.6 + 1;
        ctx.fillStyle = BCOL.ion; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(X, Y, R*.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#e8dcff'; ctx.lineWidth = 1; ctx.beginPath();
        for (let q=0; q<3; q++){ const a = rand(0,TAU), r2 = R*rand(1.6,2.6); ctx.moveTo(X + Math.cos(a)*R, Y + Math.sin(a)*R); ctx.lineTo(X + Math.cos(a+rand(-.5,.5))*r2*.7, Y + Math.sin(a+rand(-.5,.5))*r2*.7); ctx.lineTo(X + Math.cos(a)*r2, Y + Math.sin(a)*r2); }
        ctx.stroke();
        continue;
      }
      if (k==='line' || k==='oval'){
        const ang = Math.atan2(b.vy,b.vx), ca = Math.cos(ang), sa = Math.sin(ang);
        if (k==='line'){
          // hairline tracer on the full-resolution layer, one screen pixel wide
          const len = Math.max(6, b.sp*z*.025)*PX, hx = sx(b.x)*PX, hy = sy(b.y)*PX;
          hctx.moveTo(hx - ca*len, hy - sa*len); hctx.lineTo(hx, hy);
        } else {
          ctx.fillStyle = BCOL[b.kind]; ctx.beginPath(); ctx.ellipse(X, Y, s*2.2, s*1.1, ang, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(X + ca*s*.5, Y + sa*s*.5, s*1.1, s*.5, ang, 0, TAU); ctx.fill();
        }
        continue;
      }
      ctx.fillStyle = BCOL[b.kind]; ctx.fillRect(X-s, Y-s+1, 2*s, 2*s-2); ctx.fillRect(X-s+1, Y-s, 2*s-2, 2*s);
      if (s > 1){ ctx.fillStyle = '#ffffff'; const c = Math.max(1, s>>1); ctx.fillRect(X-c, Y-c, 2*c, 2*c); }
    }
  };
  hctx.setTransform(DPR,0,0,DPR,0,0); hctx.clearRect(0,0,innerWidth,innerHeight);
  hctx.lineWidth = 1;
  hctx.strokeStyle = BCOL.line; hctx.beginPath(); drawB(G.pb); hctx.stroke();
  hctx.strokeStyle = BCOL.egat; hctx.beginPath(); drawB(G.eb); hctx.stroke();

  // off-screen hostiles
  ctx.fillStyle = '#ff7a66';
  for (const s of G.ships){
    if (!s.alive || s.team!=='e' || s.fodder) continue;
    const X = sx(s.x), Y = sy(s.y), m = 8, top = Math.ceil(60/PX);
    if (X > m && Y > top && X < W-m && Y < H-m) continue;
    const ex = clamp(X, m, W-m), ey = clamp(Y, top, H-m), a = Math.atan2(Y-H/2, X-W/2);
    ctx.save(); ctx.translate(Math.round(ex),Math.round(ey)); ctx.rotate(a); ctx.globalAlpha = s.boss ? 1 : .75;
    ctx.beginPath(); const k = s.boss ? 5 : 3; ctx.moveTo(k,0); ctx.lineTo(-k*.8,k*.8); ctx.lineTo(-k*.8,-k*.8); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // touch sticks: cyan moves, gold aims
  for (const [J,col] of [[G.joy,'#5fd8ff'],[G.aimJoy,'#ffc46b']] as [Stick | null, string][]){
    if (!J) continue;
    const {x0,y0} = J, jx = J.x-x0, jy = J.y-y0, jl = Math.hypot(jx,jy), k = jl > JOY_R ? JOY_R/jl : 1;
    ctx.globalAlpha = .45; ctx.strokeStyle = '#e8ecf2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(Math.round(x0), Math.round(y0), JOY_R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .7; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(Math.round(x0 + jx*k), Math.round(y0 + jy*k), 7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // scale bar: one major grid square
  const barPx = Math.round(major*z), bx = 8, by = H - 10;
  ctx.fillStyle = '#e2ecff';
  ctx.fillRect(bx, by, barPx, 1); ctx.fillRect(bx, by-3, 1, 3); ctx.fillRect(bx+barPx-1, by-3, 1, 3);
  ctx.font = FONT(8); ctx.textAlign = 'left';
  ctx.fillText(fmtM(major/BS), bx + barPx + 4, by + 1);
  if (G.aimAuto) ctx.fillText('AUTO-AIM', bx, by - 8);

  // banner
  if (G.banner){
    const b = G.banner, a = Math.min(1, b.t/.4, (2.4-b.t+.2)/.3), y = Math.round(H*.3);
    ctx.globalAlpha = clamp(a,0,1); ctx.textAlign = 'center';
    const big = W > 260 ? 16 : 8;
    ctx.font = FONT(big); ctx.fillStyle = '#7a2a20'; ctx.fillText(b.text.toUpperCase(), Math.round(W/2)+2, y+2);
    ctx.fillStyle = '#ffc46b'; ctx.fillText(b.text.toUpperCase(), Math.round(W/2), y);
    ctx.font = FONT(8); ctx.fillStyle = b.red ? '#ff7a66' : '#9aa8d0';
    ctx.fillText(b.sub.toUpperCase(), Math.round(W/2), y + big + 6); ctx.globalAlpha = 1;
  }
}
export function fmtM(m: number){ return m >= 1000 ? (m/1000)+' km' : m+' m'; }

export function layoutBuild(){
  const pr = $('panel').getBoundingClientRect(), top = ($('hud').getBoundingClientRect().bottom + 6)/PX;
  let x0 = 0, y0 = top, x1 = W, y1 = H;
  if (pr.left/PX > W*.45) x1 = (pr.left - 8)/PX; else y1 = (pr.top - 8)/PX;
  const n = 2*buildR() + 1;
  // fit-to-area cell size, times the player's zoom; whole pixels once cells are big enough to stay crisp
  let cs = Math.min(Math.min((x1-x0)*.92, (y1-y0)*.92)/n, 16)*G.bz;
  cs = cs >= 4 ? Math.round(cs) : Math.max(1, cs);
  return {cx:Math.round((x0+x1)/2 + G.bpx), cy:Math.round((y0+y1)/2 + G.bpy), cs, n};
}
export const designType = (k: Key) => G.design.get(k);
// Share of a design turret's firing arc that has a clear line out of the hull (same ray walk as laneClear).
export const aimsOut = (t: Cell) => { const g = def(t)?.gun; return !!g && !g.homing && !g.lob && t!=='core'; };
export const designR = () => { let R = 0; for (const k of G.design.keys()) R = Math.max(R, Math.hypot(KI(k),KJ(k))); return R; };
// Cells a ray from (i,j) travels before meeting another design block, or Infinity if it gets out.
export function rayOut(i: number, j: number, a: number, R: number){
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let s=.7; s<R+1.75; s+=.45){
    const ci = Math.round(i + dx*s), cj = Math.round(j + dy*s);
    if ((ci!==i || cj!==j) && G.design.has(K(ci,cj))) return s;
  }
  return Infinity;
}
/** The turret's arc swing, for a block that has a gun. */
const arcOf = (t: Cell) => def(t)?.gun?.arc || 0;
export const ARC_N = 16, arcRays = (o: Facing, t: Cell) => Array.from({length:ARC_N}, (_,n) => FA[o] - arcOf(t) + 2*arcOf(t)*n/(ARC_N-1));
export function arcClear(i: number, j: number, o: Facing, t: Cell){
  const R = designR(); let ok = 0;
  for (const a of arcRays(o,t)) if (rayOut(i,j,a,R) === Infinity) ok++;
  return ok/ARC_N;
}
// Drydock overlay: a turret's arc as rays (cyan clear, red stopped by own hull); lasers and railguns as a line along their facing.
export function drawArc(i: number, j: number, o: Facing, t: Cell, alpha: number, R: number, len: number){
  const x = i*BS, y = j*BS;
  ctx.globalAlpha = alpha; ctx.lineWidth = ctx.lineWidth || 1;
  if (aimsOut(t)){
    for (const a of arcRays(o,t)){
      const h = rayOut(i,j,a,R), L = Math.min(h, len)*BS;
      ctx.strokeStyle = h === Infinity ? '#5fd8ff' : '#ff5a3a';
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L); ctx.stroke();
    }
    ctx.strokeStyle = '#5fd8ff'; ctx.beginPath(); ctx.arc(x, y, len*BS, FA[o] - arcOf(t), FA[o] + arcOf(t)); ctx.stroke();
  } else if (BEAM(t)){
    const a = FA[o], h = rayOut(i,j,a,R), L = Math.min(h, t==='laser' ? T.laser.laser!.range/BS : len*1.6)*BS;
    ctx.strokeStyle = h === Infinity ? (t==='laser' ? '#2ac83a' : '#b89aff') : '#ff5a3a';
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
export function renderBuild(){
  const {cx, cy, cs} = layoutBuild(), R = buildR();
  // hangar floor: big bevelled deck plates
  ctx.fillStyle = '#1a1d24'; ctx.fillRect(0,0,W,H);
  const ps = cs*4;
  for (let x = (cx % ps) - ps/2 - ps; x < W; x += ps) for (let y = (cy % ps) - ps/2 - ps; y < H; y += ps){
    const X = Math.round(x), Y = Math.round(y), P = Math.round(ps);
    ctx.fillStyle = '#2a2e37'; ctx.fillRect(X,Y,P,1); ctx.fillRect(X,Y,1,P);
    ctx.fillStyle = '#0d0f13'; ctx.fillRect(X,Y+P-1,P,1); ctx.fillRect(X+P-1,Y,1,P);
    ctx.fillStyle = '#3a3f4a'; ctx.fillRect(X+3,Y+3,1,1); ctx.fillRect(X+P-4,Y+3,1,1); ctx.fillRect(X+3,Y+P-4,1,1); ctx.fillRect(X+P-4,Y+P-4,1,1);
  }
  // grid
  const L = cx - (R+.5)*cs, Tp = cy - (R+.5)*cs, size = (2*R+1)*cs;
  ctx.fillStyle = '#0b0c10'; ctx.fillRect(L,Tp,size,size);
  ctx.strokeStyle = 'rgba(120,130,150,.18)'; ctx.beginPath();
  for (let n=0; n<=2*R+1; n++){ const v = Math.round(L + n*cs)+.5, w = Math.round(Tp + n*cs)+.5; ctx.moveTo(v,Tp); ctx.lineTo(v,Tp+size); ctx.moveTo(L,w); ctx.lineTo(L+size,w); }
  ctx.stroke();
  ctx.strokeStyle = '#ffc46b'; ctx.strokeRect(Math.round(L)+.5, Math.round(Tp)+.5, Math.round(size), Math.round(size));
  if (G.mir){
    ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(255,196,107,.35)'; ctx.beginPath();
    if (G.mir & 1){ ctx.moveTo(cx,Tp-8); ctx.lineTo(cx,Tp+size+8); }
    if (G.mir & 2){ ctx.moveTo(L-8,cy); ctx.lineTo(L+size+8,cy); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // labels
  ctx.fillStyle = '#8497c4'; ctx.font = FONT(8); ctx.textAlign = 'center';
  ctx.fillText('FORE', cx, Tp - 5);
  ctx.fillText(`${2*R+1} M`, cx, Tp + size + 12);

  const sc = cs/BS;
  ctx.save(); ctx.translate(cx,cy); ctx.scale(sc,sc); ctx.lineWidth = 1/sc;
  const aR = designR(), aLen = R + 1.5;
  ctx.globalAlpha = .35; ctx.strokeStyle = '#5fd3ff'; ctx.setLineDash([4/sc,3/sc]);
  for (const [k,t] of G.design) if (t==='shield'){ ctx.beginPath(); ctx.arc(KI(k)*BS, KJ(k)*BS, shRad(), 0, TAU); ctx.stroke(); }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  for (const [k,t] of G.design) if (aimsOut(t) || BEAM(t)) drawArc(KI(k), KJ(k), G.dirs.get(k) || 0, t, t===G.sel ? .35 : .14, aR, aLen);
  for (const [k,t] of G.design){
    const i = KI(k), j = KJ(k), o = G.dirs.get(k) || 0;
    drawBlock(ctx, t, o, 'p', i*BS, j*BS, FA[o], false, 1, false);
    // damaged: darkened plate with an orange crack
    if (G.broken.has(k)){
      ctx.globalAlpha = .6; ctx.fillStyle = '#000000'; ctx.fillRect(i*BS-5, j*BS-5, 10, 10); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff9a3a'; ctx.beginPath(); ctx.moveTo(i*BS-4,j*BS-3); ctx.lineTo(i*BS-1,j*BS); ctx.lineTo(i*BS+1,j*BS-2); ctx.lineTo(i*BS+4,j*BS+3); ctx.stroke();
      continue;
    }
    // warnings: engine exhaust covered, or a beam weapon looking into its own hull
    const bad = (t==='engine' && designType(K(i-FACE[o][0], j-FACE[o][1]))) || (BEAM(t) && !laneFwd(designType, i, j, o));
    const fc = aimsOut(t) ? arcClear(i, j, o, t) : 1;
    if (!bad && fc < .4 && fc > 0){ ctx.fillStyle = '#ffc46b'; ctx.fillRect(i*BS+1.5, j*BS-4.5, 3, 3); }
    if (bad || fc === 0){ ctx.strokeStyle = '#ff7a66'; ctx.beginPath(); ctx.moveTo(i*BS-4,j*BS-4); ctx.lineTo(i*BS+4,j*BS+4); ctx.moveTo(i*BS+4,j*BS-4); ctx.lineTo(i*BS-4,j*BS+4); ctx.stroke(); }
  }
  // group badges while assigning: the group number in its colour on every weapon
  if (G.grpBrush){
    ctx.font = FONT(4.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [k,t] of G.design){
      if (!isWeapon(t)) continue;
      const n = grpOf(k,t), x = KI(k)*BS, y = KJ(k)*BS;
      ctx.fillStyle = '#05060c'; ctx.fillRect(x-3.4, y-3.4, 6.8, 6.8);
      ctx.fillStyle = GCOL[n-1]; ctx.fillRect(x-2.8, y-2.8, 5.6, 5.6);
      ctx.fillStyle = '#05060c'; ctx.fillText(String(n), x, y+.4);
    }
    ctx.textBaseline = 'alphabetic';
  }
  // ghost
  const h = G.hover;
  if (h && !G.grpBrush && Math.max(Math.abs(h.i),Math.abs(h.j)) <= R){
    const spots = placeSpots(h.i,h.j,G.rot,G.sel);
    for (const [i,j,o] of spots){
      if (G.sel==='sell'){ ctx.globalAlpha = .9; drawBlock(ctx,'sell',0,'p',i*BS,j*BS,0,false,1,false); continue; }
      const ok = placeCheck(i,j,G.sel,o) === true, oo = T[G.sel].rot ? o : 0;
      for (const [ci,cj,ct] of cellsFor<BlockType>(i,j,G.sel,oo)){
        ctx.globalAlpha = .55; drawBlock(ctx,ct,oo,'p',ci*BS,cj*BS,FA[oo],false,1,false);
        if (ct===G.sel && (aimsOut(ct) || BEAM(ct))) drawArc(ci, cj, oo, ct, .75, aR, aLen);
        if (!ok){ ctx.globalAlpha = .8; ctx.strokeStyle = '#ff7a66'; ctx.strokeRect(ci*BS-5,cj*BS-5,10,10); }
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
