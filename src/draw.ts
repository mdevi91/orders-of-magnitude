import { Vector3 } from 'three';
import { BEAM, COL, MAXLV, def, grpOf, isWeapon, lvOf } from './catalog';
import { FACE, K, KI, KJ, KL, TAU, angDiff, clamp, rand } from './grid';
import { aimsOut, arcClear, designR, designType } from './inspect';
import { laneFwd } from './physics';
import { camera, project, projectCell } from './render3d';
import { G } from './state';
import type { Cell, Facing, Stick, Team } from './types';
import { JOY_R } from './update';
import { FONT, H, PX, W, ctx } from './view';

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
export function drawBlock(X: Ctx, t: Cell, o: Facing, team: Team, x: number, y: number, aim: number, hit: boolean, ratio: number, detail: boolean, firing?: boolean){
  const M = MET[team==='e' ? 'e' : 'p'], bx = x, by = y;
  if (t==='sell'){
    X.fillStyle = '#ff3d2a'; X.save(); X.translate(x,y); X.rotate(Math.PI/4); X.fillRect(-5,-1.2,10,2.4); X.fillRect(-1.2,-5,2.4,10); X.restore(); return;
  }
  if (!detail){
    // far out every block keeps its own colour, so weapons and systems still read
    X.fillStyle = hit ? '#ffffff' : t==='core' ? (team==='p' ? '#7fe0ff' : '#ff8a5a') : t==='armor' ? M.armor[1] : t==='hull' ? M.hull[1] : (COL[team] || COL.p)[t] || M.hull[1];
    X.fillRect(x-5,y-5,10,10); return;
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
// deep-space backdrop for the 2D star map: three parallax star layers and a few nebula clouds, all in screen space
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

// ---------- 2D overlay over the 3D view ----------
/** Corner brackets around a box on screen. */
function brackets(x: number, y: number, r: number, col: string){
  const k = Math.max(2, Math.round(r*.35)); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
  for (const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const cx = Math.round(x + sx*r) + .5, cy = Math.round(y + sy*r) + .5; ctx.moveTo(cx, cy - sy*k); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx*k, cy); }
  ctx.stroke();
}
/** Pixels a world radius covers at a world point. */
function screenR(p: Vector3, r: number){
  const d = camera.position.distanceTo(p) || 1;
  return r/d/Math.tan(camera.fov*Math.PI/360)*H/2;
}
// Fight HUD: hostile brackets and edge arrows, the crosshair, floating credit text, the touch sticks and the banner.
export function renderCombatOverlay(){
  const p = G.player!;
  for (const s of G.ships){
    if (!s.alive || s.team!=='e') continue;
    const at = project(s.p), col = s.boss || s.elite ? '#ffd04a' : s.fodder ? '#ff9a7a' : '#ff5a3a';
    const on = at && at.x > 6 && at.y > 6 && at.x < W-6 && at.y < H-6;
    if (on){ if (!s.craft) brackets(at.x, at.y, Math.max(4, screenR(s.p, s.r)), col); continue; }
    if (s.fodder) continue;
    // off screen or behind: an arrow on the edge pointing the way to turn
    const rel = s.p.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    const a = Math.atan2(-rel.y, rel.x), m = 8, top = Math.ceil(60/PX);
    const ex = clamp(W/2 + Math.cos(a)*W, m, W-m), ey = clamp(H/2 + Math.sin(a)*H, top, H-m);
    ctx.save(); ctx.translate(Math.round(ex), Math.round(ey)); ctx.rotate(a); ctx.globalAlpha = s.boss ? 1 : .75; ctx.fillStyle = col;
    ctx.beginPath(); const k = s.boss ? 5 : 3; ctx.moveTo(k,0); ctx.lineTo(-k*.8,k*.8); ctx.lineTo(-k*.8,-k*.8); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (p.alive){
    // where the nose points, and the cursor that steers it
    const nose = project(p.p.clone().add(new Vector3(0,0,-1).applyQuaternion(p.q).multiplyScalar(800*G.SC)));
    if (nose){ ctx.strokeStyle = '#9aa8d0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(nose.x)+.5, Math.round(nose.y)+.5, 4, 0, TAU); ctx.stroke(); }
    if (G.mouse.has && !G.joy){
      const x = Math.round(G.mouse.x)+.5, y = Math.round(G.mouse.y)+.5;
      ctx.strokeStyle = '#ffc46b'; ctx.beginPath(); ctx.moveTo(x-6,y); ctx.lineTo(x-2,y); ctx.moveTo(x+2,y); ctx.lineTo(x+6,y); ctx.moveTo(x,y-6); ctx.lineTo(x,y-2); ctx.moveTo(x,y+2); ctx.lineTo(x,y+6); ctx.stroke();
    }
  }
  ctx.font = FONT(8); ctx.textAlign = 'center';
  for (const f of G.fx) if (f.k==='txt'){
    const at = project(f.p); if (!at) continue;
    ctx.globalAlpha = clamp(f.life/f.max, 0, 1); ctx.fillStyle = '#ffc46b'; ctx.fillText(f.text, Math.round(at.x), Math.round(at.y));
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
  ctx.textAlign = 'left'; ctx.fillStyle = '#e2ecff';
  if (G.aimAuto) ctx.fillText('AUTO-AIM', 8, H - 10);
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
// Drydock markers: ✕ on blocks that can't fire or thrust, a gold dot on boxed-in turrets, group numbers while assigning.
export function renderBuildOverlay(){
  ctx.font = FONT(8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fore = projectCell(0, -designR() - 3, 0);
  if (fore){ ctx.fillStyle = '#8497c4'; ctx.fillText('FORE', Math.round(fore.x), Math.round(fore.y)); }
  for (const [k,t] of G.design){
    const i = KI(k), j = KJ(k), l = KL(k), o = G.dirs.get(k) || 0, at = projectCell(i, j, l);
    if (!at) continue;
    const X = Math.round(at.x), Y = Math.round(at.y);
    if (G.grpBrush && isWeapon(t)){ ctx.fillStyle = '#05060c'; ctx.fillText(String(grpOf(k,t)), X+1, Y+1); ctx.fillStyle = '#ffffff'; ctx.fillText(String(grpOf(k,t)), X, Y); continue; }
    if (G.broken.has(k)) continue;
    const [fi,fj,fl] = FACE[o];
    const bad = (t==='engine' && designType(K(i-fi, j-fj, l-fl))) || (BEAM(t) && !laneFwd(designType, i, j, l, o));
    const fc = aimsOut(t) ? arcClear(i, j, l, o, t) : 1;
    if (bad || fc === 0){ ctx.strokeStyle = '#ff7a66'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X-3,Y-3); ctx.lineTo(X+3,Y+3); ctx.moveTo(X+3,Y-3); ctx.lineTo(X-3,Y+3); ctx.stroke(); }
    else if (fc < .4){ ctx.fillStyle = '#ffc46b'; ctx.fillRect(X-1, Y-1, 3, 3); }
  }
  ctx.textBaseline = 'alphabetic';
}
