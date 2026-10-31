import { BCOL, BEAM, COCKPITS, ESH, GCOL, HEAD_OF, MAXLV, T, WEDGE, cockpit, cpArc, def, faceFor, grpOf, isArm, isWeapon, lvOf, mountFor, rangeMul, traverse, turns, angAt, mountAt, mountFits, mountText, MOUNTS, ANG_STEP, M_PER_BLOCK, shRad, type MountKind, type MountLook } from './catalog';
import { rangeOf } from './bullets';
import { cellsFor, headOf, placeCheck, placeSpots } from './editor';
import { WARP } from './fights';
import { BS, CORE, FA, FACE, K, KI, KJ, SWING, TAU, angDiff, clamp, rand } from './grid';
import { laneFwd } from './physics';
import { boost, boostText, boostable, designFeeds, wpos } from './ships';
import { G, buildR, closeSpan, spanFor } from './state';
import { JOY_R, RAIL_CHARGE, keys } from './update';
import type { BlockType, Bullet, BulletKind, Cell, CraftKind, Facing, Key, Ship, Stick, Team } from './types';
import { drawTargeting } from './targeting';
import { drawStatus } from './status';
import { drawHazard } from './hazards';
import { $, DPR, FONT, H, PX, W, ctx, hctx } from './view';
import { BAKE, blit, hasSpr, sprTinted, type Tint } from './mods';

// ---------- drawing ----------
// Cel-shaded metal sprites, 90s mecha anime style: each block is an inked plate with a flat face, a hard shadow band and a
// sharp highlight edge, with its part drawn on top.
// Palettes are [highlight, base, shadow].
type Ctx = CanvasRenderingContext2D;
/** [highlight, base, shadow] */
type Pal3 = [string, string, string];
export const MET: Record<'p'|'e', {hull: Pal3; armor: Pal3; dark: Pal3}> = {
  p:{hull:['#d4dbe6','#8590a1','#454c5a'], armor:['#b4bcc8','#5f6878','#2b3039'], dark:['#7d8796','#3d4350','#1c1f26']},
  e:{hull:['#e08a62','#9a4630','#4a1c12'], armor:['#b8705a','#6a3024','#30120c'], dark:['#8a4a3a','#4a2018','#200a06']},
};
// Paint schemes for the player's plating, picked in Engineering; systems keep the dark metal. Enemies always wear rust.
export const PAINTS: Record<string, {name: string; hull: Pal3; armor: Pal3; dark: Pal3}> = {
  steel: {name:'Steel', ...MET.p},
  ivory: {name:'Ivory', hull:['#ffffff','#d6dae2','#868c9a'], armor:['#ece6da','#aaa598','#5a564d'], dark:MET.p.dark},
  navy:  {name:'Navy', hull:['#a8c4f0','#3e5e9e','#1a2a52'], armor:['#8098c8','#2c3c6c','#121a34'], dark:MET.p.dark},
  olive: {name:'Olive', hull:['#d0d8a6','#7c8652','#3a4020'], armor:['#a6ae7c','#565e36','#262a14'], dark:MET.p.dark},
  violet:{name:'Violet', hull:['#dcc6f2','#7c5caa','#3a2858'], armor:['#b49ad2','#503c76','#22183a'], dark:MET.p.dark},
};
// Sprites the mod editor can replace (see mods.ts), one per thing for every paint scheme and both sides: plate/<hull|armor|dark>,
// part/<cell>, block/<wedge>, cockpit/<id>, craft/<kind>, bullet/<kind>. Each is painted in the player's steel look, faces
// up, and is tinted in game (tintFor): plating to the paint scheme, anything on an enemy to rust.
export const modId = (id: string) => hasSpr(id) ? id : '';
export const GUN_P: Pal3 = ['#e8eef6','#9aa4b4','#2a2e36'], GUN_E: Pal3 = ['#ffd08a','#c8783a','#4a2010'];
const CRAFT_P = ['#0a1830','#bcd0f5','#5a78b8'], CRAFT_E = ['#5a1008','#ff7a66','#a83a2e'];
/** The tint a modded sprite takes in game: material hull, armor, dark (systems and guns), cockpit or craft; none for the
 *  player's steel paint, or for systems, which keep their metal whatever the paint. */
export function tintFor(team: Team, mat: 'hull' | 'armor' | 'dark' | 'cockpit' | 'craft'): Tint | undefined {
  if (team==='e') return mat==='craft' ? {key:'ecraft', src:CRAFT_P, dst:CRAFT_E}
    : mat==='dark' ? {key:'edark', src:[...MET.p.dark, ...GUN_P], dst:[...MET.e.dark, ...GUN_E]}
    : mat==='cockpit' ? {key:'eck', src:[...MET.p.hull, ...MET.p.armor], dst:[...MET.e.hull, ...MET.e.armor]}
    : {key:'e'+mat, src:MET.p[mat], dst:MET.e[mat]};
  const P = PAINTS[G.paint];
  if (!P || G.paint==='steel' || mat==='dark' || mat==='craft') return undefined;
  return mat==='cockpit' ? {key:G.paint+'ck', src:[...MET.p.hull, ...MET.p.armor], dst:[...P.hull, ...P.armor]} : {key:G.paint+mat, src:MET.p[mat], dst:P[mat]};
}
// parts whose barrel swings to the aim point; their sprite is drawn turned that way
export const TURRET = new Set<string>(['cannon', 'gun', 'bigcannon', 'hgatling', 'scatter', 'ion', 'goo', 'hack', 'torpedo', 'flak', 'gatling', 'plasma', 'glimmer']);
export function plate(X: Ctx, x: number, y: number, m: Pal3){
  X.fillStyle = '#0b0d12'; X.fillRect(x-5,y-5,10,10);
  X.fillStyle = m[1]; X.fillRect(x-4.4,y-4.4,8.8,8.8);
  X.fillStyle = m[2]; X.fillRect(x-4.4,y+1.2,8.8,3.2);
  X.fillStyle = m[0]; X.fillRect(x-4.4,y-4.4,8.8,1); X.fillRect(x-4.4,y-4.4,1,5);
}
// a burst of hexagons on a shield where it was just hit
function hexFlash(X: Ctx, cx: number, cy: number, r: number, ha: number, col: string){
  const hs = Math.max(2, r*.16), px = cx + Math.cos(ha)*r*.82, py = cy + Math.sin(ha)*r*.82;
  X.save(); X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.clip();
  X.strokeStyle = col; X.lineWidth = 1;
  for (const [q, w] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){
    const hx = px + hs*1.5*q, hy = py + hs*Math.sqrt(3)*(w + q/2);
    X.beginPath(); for (let n=0; n<6; n++){ const a = n*Math.PI/3; X.lineTo(hx + Math.cos(a)*hs*.92, hy + Math.sin(a)*hs*.92); } X.closePath(); X.stroke();
  }
  X.restore();
}
export function orb(X: Ctx, x: number, y: number, r: number, cols: string[]){ for (let n=0; n<cols.length; n++){ X.fillStyle = cols[n]; X.beginPath(); X.arc(x - n*r*.12, y - n*r*.12, r*(1 - n/cols.length), 0, TAU); X.fill(); } }
export function barrel(X: Ctx, x: number, y: number, ca: number, sa: number, len: number, w: number, m: Pal3){
  const px = -sa*w/2, py = ca*w/2;
  X.fillStyle = m[2]; X.beginPath(); X.moveTo(x+px,y+py); X.lineTo(x+px+ca*len,y+py+sa*len); X.lineTo(x-px+ca*len,y-py+sa*len); X.lineTo(x-px,y-py); X.closePath(); X.fill();
  X.fillStyle = m[0]; X.beginPath(); X.moveTo(x+px*.3,y+py*.3); X.lineTo(x+px*.3+ca*len,y+py*.3+sa*len); X.lineTo(x-px*.4+ca*len,y-py*.4+sa*len); X.lineTo(x-px*.4,y-py*.4); X.closePath(); X.fill();
}
/** The mount a weapon sits on, drawn under it: a braced bracket, a gimbal, a turret ring, a raised barbette or a dome. */
export function drawMount(X: Ctx, kind: MountLook, team: Team, x: number, y: number, rot: number, r = 1){
  const dark = '#14171e', [hi, mid] = team==='e' ? ['#c8783a', '#6a3418'] : ['#9aa4b4', '#4a525e'];
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(r, r);
  if (kind==='fixed'){
    X.fillStyle = dark; X.fillRect(-3.8,-3.8,7.6,7.6); X.fillStyle = mid; X.fillRect(-3.8,-3.8,7.6,1.2); X.fillRect(-3.8,-3.8,1.2,7.6);
    X.fillStyle = hi; for (const [a,b] of [[-3.2,2.4],[2.4,2.4]]) X.fillRect(a,b,.8,.8);
  } else if (kind==='barbette'){
    // raised: a drop shadow under a thick ring, lit on its upper left
    X.fillStyle = 'rgba(0,0,0,.45)'; X.beginPath(); X.arc(.8, .9, 4.6, 0, TAU); X.fill();
    X.fillStyle = mid; X.beginPath(); X.arc(0, 0, 4.6, 0, TAU); X.fill();
    X.fillStyle = hi; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 4.6, Math.PI, Math.PI*1.5); X.closePath(); X.fill();
    X.fillStyle = dark; X.beginPath(); X.arc(0, 0, 3.3, 0, TAU); X.fill();
  } else if (kind==='dome'){
    X.fillStyle = 'rgba(0,0,0,.4)'; X.beginPath(); X.arc(.7, .8, 4.8, 0, TAU); X.fill();
    orb(X, 0, 0, 4.8, [dark, mid, hi]);
    X.strokeStyle = dark; X.lineWidth = .5; X.beginPath(); X.arc(0, 0, 3.2, 0, TAU); X.stroke();
  } else {
    // a gimbal is a small ring with two pivots; a turret ring is wider, with traverse ticks
    const R = kind==='ring' ? 4.4 : 3.6;
    X.fillStyle = mid; X.beginPath(); X.arc(0, 0, R, 0, TAU); X.fill(); X.fillStyle = dark; X.beginPath(); X.arc(0, 0, R - 1.1, 0, TAU); X.fill();
    X.fillStyle = hi;
    if (kind==='ring') for (let q=0; q<8; q++){ const a = q*TAU/8; X.fillRect(Math.cos(a)*(R-.5) - .3, Math.sin(a)*(R-.5) - .3, .6, .6); }
    else { X.fillRect(-R, -.4, 1, .8); X.fillRect(R - 1, -.4, 1, .8); }
  }
  X.restore();
}
/** layer 'base' draws only a block's plating (with hits and wear), 'arm' only what sits on it: the mount and the weapon,
 *  drawn after the whole hull so barrels reach over the neighbouring blocks. */
/** Each support module's colour: its sprite, and its links to the weapons it feeds in the drydock. */
export const MODCOL: Record<string, string> = {rmod:'#7fe8ff', dmod:'#ff7a5a', cmod:'#ffd04a'};
// mk, ao: a player's weapon on a mount fitted from cargo, and its arc angled off the facing
export function drawBlock(X: Ctx, t: Cell, o: Facing, team: Team, x: number, y: number, aim: number, hit: boolean, ratio: number, firing?: boolean, layer?: 'base' | 'arm', mk?: MountKind, ao = 0){
  if (layer==='arm'){
    const was = BAKE.noPlate; BAKE.noPlate = true;
    try {
      if (!HEAD_OF[t]) drawMount(X, MOUNTS[mk || mountFor(t)].look, team, x, y, (o ? o*Math.PI/4 : 0) + ao);
      drawBlock(X, t, o, team, x, y, aim, false, 1, firing, undefined, mk, ao);
    } finally { BAKE.noPlate = was; }
    if (hit){ X.globalAlpha = .7; X.fillStyle = '#ffffff'; X.beginPath(); X.arc(x, y, 4.6, 0, TAU); X.fill(); X.globalAlpha = 1; }
    return;
  }
  const M = team==='e' ? MET.e : PAINTS[G.paint] || MET.p, bx = x, by = y;
  if (t==='sell'){
    X.fillStyle = '#ff3d2a'; X.save(); X.translate(x,y); X.rotate(Math.PI/4); X.fillRect(-5,-1.2,10,2.4); X.fillRect(-1.2,-5,2.4,10); X.restore(); return;
  }
  if (WEDGE(t)){
    // corner plating: the solid half-cell is bottom-left in its own frame, the cut faces up-right; turned to its diagonal
    const m = t==='armorc' ? M.armor : M.hull, tri = (pts: number[]) => { X.beginPath(); X.moveTo(pts[0], pts[1]); for (let n=2; n<pts.length; n+=2) X.lineTo(pts[n], pts[n+1]); X.closePath(); X.fill(); };
    X.save(); X.translate(x,y); X.rotate((((o || 1) - 1)/2)*Math.PI/2);
    const id = modId('block/'+t);
    if (id) blit(X, id, 0, 0, 0, 1, tintFor(team, t==='armorc' ? 'armor' : 'hull'));
    else {
      X.fillStyle = '#0b0d12'; tri([-5,-5.6, -5,5, 5.6,5]);
      X.fillStyle = m[1]; tri([-4.4,-3.2, -4.4,4.4, 3.2,4.4]);
      X.fillStyle = m[2]; tri([-4.4,1.2, 0,1.2, 3.2,4.4, -4.4,4.4]);
      X.fillStyle = m[0]; X.fillRect(-4.4,-3.2,1,4.4);
      if (t==='armorc'){ X.fillStyle = m[2]; tri([-2.8,.2, -2.8,2.8, -.2,2.8]); }
      else { X.fillStyle = m[0]; X.fillRect(-3.4,2.6,.8,.8); }
    }
    if (hit){ X.fillStyle = '#ffffff'; X.globalAlpha = .85; tri([-5,-5.6, -5,5, 5.6,5]); X.globalAlpha = 1; }
    else if (ratio < .7){ X.fillStyle = '#000000'; X.globalAlpha = (1-ratio)*.45; tri([-5,-5.6, -5,5, 5.6,5]); X.globalAlpha = 1; }
    X.restore(); return;
  }
  // a weapon's cell is plated as hull, the mount sitting on top of it
  const pt = layer==='base' ? 'hull' : t, base = pt==='armor' ? M.armor : pt==='hull' ? M.hull : M.dark, mat = pt==='armor' || pt==='hull' ? pt : 'dark';
  if (!BAKE.noPlate){ const id = modId('plate/'+mat); if (id) blit(X, id, x, y, 0, 1, tintFor(team, mat)); else plate(X,x,y,base); }
  if (hit){ X.fillStyle = '#ffffff'; X.globalAlpha = .85; X.fillRect(x-5,y-5,10,10); X.globalAlpha = 1; return; }
  if (layer==='base'){
    if (ratio < .7){ X.globalAlpha = (1-ratio)*.4; X.fillStyle = '#000000'; X.fillRect(x-5,y-5,10,10); X.globalAlpha = 1; }
    return;
  }
  const d = def(t), rot = o ? o*Math.PI/4 : 0;
  if (rot){ X.save(); X.translate(x,y); X.rotate(rot); x = 0; y = 0; }
  let ang = aim - rot;
  const arc = d && d.gun ? (team==='p' ? (turns(t) ? traverse(t, mk).arc : cpArc(d.gun.arc || 0)) : d.gun.arc || 0) : 0, mid = -Math.PI/2 + ao;
  if (arc) ang = mid + clamp(angDiff(ang, mid), -arc, arc);
  const ca = Math.cos(ang), sa = Math.sin(ang), gun: Pal3 = team!=='e' ? ['#e8eef6','#9aa4b4','#2a2e36'] : ['#ffd08a','#c8783a','#4a2010'];
  // an enemy-only part (a carrier bay) is drawn as painted, already in enemy colours
  const pid = modId('part/'+t);
  if (pid) blit(X, pid, x, y, TURRET.has(t) ? ang + Math.PI/2 : 0, 1, d ? tintFor(team, mat) : undefined);
  else switch (t as string){
    case 'cockpit':
      // cockpit plating, seen only when its cockpit sprite can't be drawn whole
      X.fillStyle = '#3a4a5c'; X.fillRect(x-3,y-3,6,6); X.fillStyle = '#5fd8ff'; X.fillRect(x-1.5,y-.5,3,1); break;
    case 'hull':
      // a panel seam and four rivets
      X.fillStyle = base[2]; X.fillRect(x-.5,y-3,1,6);
      X.fillStyle = base[0]; for (const [a,b] of [[-3.2,-3.2],[2.4,-3.2],[-3.2,2.4],[2.4,2.4]]) X.fillRect(x+a,y+b,.8,.8); break;
    case 'armor':
      X.fillStyle = base[2]; X.fillRect(x-3,y-3,6,6); X.fillStyle = base[0]; X.fillRect(x-3,y-3,5,1); X.fillRect(x-3,y-3,1,5);
      X.fillStyle = base[0]; for (const [a,b] of [[-3.4,-3.4],[2.6,-3.4],[-3.4,2.6],[2.6,2.6]]) X.fillRect(x+a,y+b,.9,.9); break;
    case 'core':
      // the core: a glowing orb with a pulsing halo; bigger cockpits are drawn over their whole footprint by drawCockpit
      orb(X,x,y,4.2, team!=='p' ? ['#5a1008','#c0301a','#ff8a5a','#fff0d0'] : ['#0a3a6a','#1a8ad0','#5fd8ff','#e8ffff']); break;
    case 'cannon': case 'gun':
      // a long slim barrel through a cooling shroud
      barrel(X,x,y,ca,sa,9,1.8,gun); barrel(X,x,y,ca,sa,5,3.2,gun); orb(X,x,y,3, [gun[2],gun[1],gun[0]]); break;
    case 'bigcannon':
      barrel(X,x,y,ca,sa,11.5,2.6,gun); barrel(X,x,y,ca,sa,6,4.6,gun); orb(X,x,y,4, [gun[2],gun[1],gun[0]]);
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
    case 'goo':
      // a flared spray nozzle over a bubbling tank of goo
      barrel(X,x,y,ca,sa,5.6,2.2,gun); X.fillStyle = gun[2]; X.fillRect(x + ca*5.6 - 1.4, y + sa*5.6 - 1.4, 2.8, 2.8);
      orb(X,x,y,3.2, ['#1a3a0a','#4aa020','#9cff5a']);
      X.fillStyle = '#e8ffd0'; X.fillRect(x - 1 + Math.sin(G.time*3 + x)*.8, y - .8, 1, 1); break;
    case 'hack':
      // a launch cradle holding the next hacking module, its status light blinking
      barrel(X,x,y,ca,sa,6.2,2.6,gun); orb(X,x,y,3, ['#0a2a20','#1a8a60','#4affb0']);
      X.fillStyle = '#1a1e24'; X.fillRect(x + ca*3 - 1.3, y + sa*3 - 1.3, 2.6, 2.6);
      X.fillStyle = Math.sin(G.time*6 + x) > 0 ? '#4affb0' : '#ff3d5a'; X.fillRect(x + ca*3 - .5, y + sa*3 - .5, 1, 1); break;
    case 'tesla': {
      X.fillStyle = '#1a1430'; X.fillRect(x-3.6,y-3.6,7.2,7.2);
      orb(X,x,y,3, ['#2a1a4a','#8a6ae0','#e8dcff']);
      const k = G.time*9 + x;
      X.fillStyle = '#ffffff'; for (let q=0; q<3; q++){ const a = k + q*TAU/3; X.fillRect(x + Math.cos(a)*3.6 - .5, y + Math.sin(a)*3.6 - .5, 1, 1); }
      break;
    }
    case 'torpedo':
      barrel(X,x,y,ca,sa,6.4,3.2,['#ffe8a0','#a07a20','#2a2008']); orb(X,x,y,2.6, ['#2a2008','#a07a20','#ffe08a']); break;
    case 'torpedo_b':
      // the tube's rear: the next torpedo waiting in the rack
      X.fillStyle = '#20242c'; X.fillRect(x-3.6,y-4,7.2,8); X.fillStyle = '#a07a20'; X.fillRect(x-1.8,y-4,3.6,7);
      X.fillStyle = '#ffe08a'; X.fillRect(x-1.8,y-4,1,7); X.fillStyle = '#5a6270'; X.fillRect(x-2.6,y+2,5.2,1.6); break;
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
    case 'plasma':
      // a fat emitter barrel over a violet containment orb
      barrel(X,x,y,ca,sa,8,3.4,gun); orb(X,x,y,3.6, ['#3a0a3a','#c040c0','#ffb0ff']);
      X.fillStyle = '#ffffff'; X.fillRect(x-.6,y-.6,1.2,1.2); break;
    case 'swarm':
      // a pod of six little tubes
      X.fillStyle = '#20242c'; X.fillRect(x-4,y-4,8,8);
      for (let q=0; q<6; q++){ const tx = x - 2.6 + (q % 3)*2.6, ty = y - 1.6 + Math.floor(q/3)*3.2; X.fillStyle = '#d8dde6'; X.fillRect(tx-.8,ty-1.1,1.6,2.2); X.fillStyle = '#ffb030'; X.fillRect(tx-.8,ty-1.1,1.6,.8); }
      break;
    case 'swarm_b':
      // more of the pod: a grid of capped launch tubes
      X.fillStyle = '#20242c'; X.fillRect(x-4,y-4,8,8);
      for (let q=0; q<4; q++){ const tx = x - 1.8 + (q % 2)*3.6, ty = y - 1.8 + Math.floor(q/2)*3.6; X.fillStyle = '#5a6270'; X.fillRect(tx-1.2,ty-1.2,2.4,2.4); X.fillStyle = '#ffb030'; X.fillRect(tx-.6,ty-.6,1.2,1.2); }
      break;
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
      X.fillStyle = '#ff7a2a'; X.fillRect(x-2.4,y+3,4.8,1.4); break;
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
    case 'glimmer':
      // a slim emitter rod over a pale green lens
      barrel(X,x,y,ca,sa,7,1.4,['#eaffe4','#8ac888','#1e3a1e']); orb(X,x,y,2.8, ['#1e3a1e','#9ad890','#eaffe4']);
      X.fillStyle = '#ffffff'; X.fillRect(x-.5,y-.5,1,1); break;
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
    // support modules: a dark plate with feed ports on every side, and what they feed the weapons around them
    case 'rmod': case 'dmod': case 'cmod': {
      const col = MODCOL[t], k = .5 + .5*Math.sin(G.time*4 + x*.3);
      X.fillStyle = '#1a1e26'; X.fillRect(x-3.8,y-3.8,7.6,7.6);
      X.fillStyle = '#4a525e'; X.fillRect(x-3.8,y-3.8,7.6,.8); X.fillRect(x-3.8,y-3.8,.8,7.6);
      X.fillStyle = col; X.fillRect(x-.7,y-4.6,1.4,1.2); X.fillRect(x-.7,y+3.4,1.4,1.2); X.fillRect(x-4.6,y-.7,1.2,1.4); X.fillRect(x+3.4,y-.7,1.2,1.4);
      if (t==='rmod'){
        // a rangefinder lens with its crosshair
        orb(X, x, y, 2.6, ['#0a2a3a', '#2a8ab0', k > .5 ? '#d8f8ff' : '#7fe8ff']);
        X.fillStyle = '#0a1a24'; X.fillRect(x-2.6,y-.25,5.2,.5); X.fillRect(x-.25,y-2.6,.5,5.2);
      } else if (t==='dmod'){
        // a capacitor bank, its middle cell pulsing
        for (let q=0; q<3; q++){ X.fillStyle = '#4a1a10'; X.fillRect(x-2.8+q*2,y-2.6,1.6,5.2); X.fillStyle = q===1 && k > .5 ? '#ffe0c8' : col; X.fillRect(x-2.8+q*2,y-2.6,1.6,1.4); }
        X.fillStyle = '#ffe0c8'; X.fillRect(x-.3,y+.4,.6,1.8);
      } else {
        // an ammunition drum turning
        orb(X, x, y, 2.8, ['#3a2a08', '#a07a20', '#ffe08a']);
        X.fillStyle = '#1a1208'; for (let q=0; q<6; q++){ const a = G.time*3 + q*TAU/6; X.fillRect(x + Math.cos(a)*1.7 - .45, y + Math.sin(a)*1.7 - .45, .9, .9); }
      }
      break;
    }
    case 'mfixed': case 'mfixed2': case 'mgimbal': case 'mgimbal2': case 'mring': case 'mring2': case 'mbarbette': case 'mbarbette2': case 'mdome': case 'mdome2':
      drawMount(X, MOUNTS[T[t as BlockType].mount!].look, team, x, y, 0);
      // a Mk II wears a gold pip
      if (MOUNTS[T[t as BlockType].mount!].mk===2){ X.fillStyle = '#ffc46b'; X.fillRect(x+2.6, y-4.4, 1.8, 1.8); }
      break;
    case 'battery':
      X.fillStyle = '#142a14'; X.fillRect(x-3.6,y-3,7.2,6);
      for (let q=0; q<3; q++){ X.fillStyle = '#3ac84a'; X.fillRect(x-2.9+q*2.2,y-2.3,1.6,4.6); X.fillStyle = '#b8ffb0'; X.fillRect(x-2.9+q*2.2,y-2.3,1.6,.9); }
      X.fillStyle = '#9aa4b4'; X.fillRect(x-1,y-4,2,1); break;
    case 'pd':
      orb(X,x,y,3.2, ['#2a1a4a','#7a4ad0','#d8c0ff']); X.fillStyle = '#ffffff'; X.fillRect(x-.5,y-.5,1,1); break;
    case 'aegis':
      // the battery's fire-control dome, with a twin gun mount
      orb(X,x,y,4.2, ['#2a1a4a','#7a4ad0','#d8c0ff']); X.fillStyle = '#d8c0ff'; X.fillRect(x-3,y-4.4,1.2,3); X.fillRect(x+1.8,y-4.4,1.2,3);
      X.fillStyle = '#ffffff'; X.fillRect(x-.6,y-.6,1.2,1.2); break;
    case 'aegis_b':
      // sensor plating: a small violet emitter on a vented panel
      X.fillStyle = '#20242c'; X.fillRect(x-4,y-4,8,8); X.fillStyle = '#4a3a6a'; for (let q=-3; q<4; q+=2) X.fillRect(x-3,y+q-.4,6,.8);
      orb(X,x,y,1.6, ['#2a1a4a','#9a6af0','#e8dcff']); break;
  }
  // a modded sprite replaces the drawing whole, glow included; the engine's exhaust is thrust, not part of the sprite
  if (!BAKE.on && !pid && t==='core'){
    X.globalAlpha = .25 + .2*Math.sin(G.time*6); X.fillStyle = '#ffffff'; X.beginPath(); X.arc(x,y,4.6,0,TAU); X.fill();
    // the halo ring, except under a bigger cockpit, whose sprite covers the core
    if (team!=='p' || !cockpit().cells.length){ X.globalAlpha = .55 + .35*Math.sin(G.time*4); X.strokeStyle = team!=='p' ? '#ffb08a' : '#7fe8ff'; X.lineWidth = .9;
      X.beginPath(); X.arc(x,y,5.6 + .5*Math.sin(G.time*4),0,TAU); X.stroke(); }
    X.globalAlpha = 1;
  }
  if (!BAKE.on && t==='engine' && firing){
    const L = rand(5,10);
    X.fillStyle = '#ff4a1a'; X.beginPath(); X.moveTo(x-3,y+4.6); X.lineTo(x+3,y+4.6); X.lineTo(x,y+4.6+L); X.closePath(); X.fill();
    X.fillStyle = '#ffd04a'; X.beginPath(); X.moveTo(x-1.9,y+4.6); X.lineTo(x+1.9,y+4.6); X.lineTo(x,y+4.6+L*.65); X.closePath(); X.fill();
    X.fillStyle = '#ffffff'; X.beginPath(); X.moveTo(x-.9,y+4.6); X.lineTo(x+.9,y+4.6); X.lineTo(x,y+4.6+L*.3); X.closePath(); X.fill();
  }
  if (rot) X.restore();
  // battle damage: scorched, cracked plating with the hot internals glowing through
  if (ratio < .7){
    X.globalAlpha = (1-ratio)*.4; X.fillStyle = '#000000'; X.fillRect(bx-5,by-5,10,10); X.globalAlpha = 1;
    const f = .55 + .45*Math.sin(G.time*14 + bx*.7 + by*.3), crack = () => { X.beginPath(); X.moveTo(bx-4,by-3); X.lineTo(bx-1,by-.5); X.lineTo(bx+1,by-2); X.lineTo(bx+4,by+2.5); X.stroke(); };
    X.strokeStyle = '#120806'; X.lineWidth = 1.3; crack();
    X.strokeStyle = `rgba(255,${(120 + 90*f)|0},40,${.4 + .6*f})`; X.lineWidth = .55; crack();
  }
  // level pips: one gold chevron per level above 1, plus a gold trim at max level
  if (team==='p' && d && !BAKE.on){
    const L = lvOf(t);
    X.fillStyle = '#ffc46b'; for (let q=1; q<L; q++) X.fillRect(bx-4+(q-1)*2.1, by+1.8, 1.6, 1.4);
    if (L >= MAXLV){ X.globalAlpha = .7; X.fillRect(bx-5,by-5,10,.8); X.globalAlpha = 1; }
  }
}
// Each cockpit has its own sprite drawn over its whole footprint (ship-local units, the core at 0,0, front is up).
// has() says whether a cell is still there; a cockpit missing a cell falls back to plain plating.
export function drawCockpit(X: Ctx, id: string, has: (k: Key) => boolean){
  const C = COCKPITS[id as keyof typeof COCKPITS]; if (!C || !C.cells.length || !C.cells.every(([i,j]) => has(K(i,j))) || !has(CORE)) return;
  const cid = modId('cockpit/'+id); if (cid){ blit(X, cid, 0, 0, 0, 1, tintFor('p', 'cockpit')); return; }
  // a modded cockpit or core cell beats the stock cockpit picture: leave the cells to show their own sprites
  if (modId('part/cockpit') || modId('part/core')) return;
  const P = PAINTS[G.paint] || MET.p, ink = '#0b0d12', glass = ['#0a3a6a','#1a8ad0','#5fd8ff','#e8ffff'];
  const poly = (pts: number[], col: string) => { X.fillStyle = col; X.beginPath(); X.moveTo(pts[0], pts[1]); for (let n=2; n<pts.length; n+=2) X.lineTo(pts[n], pts[n+1]); X.closePath(); X.fill(); };
  const rect = (x0: number, y0: number, x1: number, y1: number, col: string) => { X.fillStyle = col; X.fillRect(x0, y0, x1-x0, y1-y0); };
  const pulse = .55 + .35*Math.sin(G.time*4);
  if (id==='fighter'){
    // corvette: a dart with a long teardrop canopy and swept wing roots
    poly([0,-6.6, 5.6,6, 5.6,15.4, -5.6,15.4, -5.6,6], ink);
    poly([0,-5, 4.6,6.2, 4.6,14.6, -4.6,14.6, -4.6,6.2], P.hull[1]);
    poly([0,4, 4.6,6.2, 4.6,14.6, 0,14.6], P.hull[2]);
    X.fillStyle = glass[1]; X.beginPath(); X.ellipse(0, 2, 2.2, 5, 0, 0, TAU); X.fill();
    X.fillStyle = glass[2]; X.beginPath(); X.ellipse(-.5, 1, 1.2, 3.4, 0, 0, TAU); X.fill();
    rect(-3.6, 13.4, -1.4, 14.6, '#ffb27a'); rect(1.4, 13.4, 3.6, 14.6, '#ffb27a');
  } else if (id==='cruiser'){
    // cruiser bridge: a chamfered armoured block with a window band and a grid of missile hatches
    poly([-2,-5.6, 12,-5.6, 15.6,-2, 15.6,12, 12,15.6, -2,15.6, -5.6,12, -5.6,-2], ink);
    poly([-1.4,-4.8, 11.4,-4.8, 14.8,-1.4, 14.8,11.4, 11.4,14.8, -1.4,14.8, -4.8,11.4, -4.8,-1.4], P.armor[1]);
    rect(-4.8, 7, 14.8, 11.4, P.armor[2]); rect(-1.4, -4.8, 11.4, -3.8, P.armor[0]);
    rect(-2.4, -2.4, 12.4, .8, ink); rect(-1.8, -1.8, 11.8, .2, glass[2]);
    for (let q=0; q<6; q++){ const hx = -1 + (q % 3)*5, hy = 4 + Math.floor(q/3)*4.6; rect(hx-1.6, hy-1.6, hx+1.6, hy+1.6, ink); rect(hx-1, hy-1, hx+1, hy-.2, '#ff8a3a'); }
  } else if (id==='carrier'){
    // carrier deck: a long flight deck with a dashed runway, edge stripes and a small bridge island
    rect(-5.6, -15.6, 5.6, 25.6, ink); rect(-4.8, -14.8, 4.8, 24.8, '#2a2e36');
    rect(-4.8, -14.8, -3.4, 24.8, P.hull[1]); rect(3.4, -14.8, 4.8, 24.8, P.hull[1]);
    X.fillStyle = '#ffd04a'; for (let y = -12; y < 23; y += 5) X.fillRect(-.5, y, 1, 2.6);
    poly([0,-15, 2.6,-11, -2.6,-11], '#ffd04a');
    rect(1.4, -3, 4.8, 3, P.hull[2]); rect(2, -2, 4.2, -.4, glass[2]);
    X.globalAlpha = pulse; rect(-3, 22.6, 3, 23.6, '#5fd8ff'); X.globalAlpha = 1;
  } else if (id==='battle'){
    // command bridge: a wide armoured bar with gold trim and side windows, a glass dome at the heart, a ribbed tower behind
    rect(-15.6, -5.6, 15.6, 5.6, ink); rect(-5.6, 5, 5.6, 15.6, ink);
    rect(-14.8, -4.8, 14.8, 4.8, P.armor[1]); rect(-4.8, 4, 4.8, 14.8, P.armor[1]);
    rect(-14.8, 1.6, 14.8, 4.8, P.armor[2]);
    rect(-14.8, -4.8, 14.8, -4, '#ffc46b'); rect(-14.8, -4.8, -14, 4.8, '#ffc46b'); rect(14, -4.8, 14.8, 4.8, '#ffc46b');
    for (const s of [-1, 1]){ rect(s > 0 ? 7 : -13, -1.6, s > 0 ? 13 : -7, .4, ink); rect(s > 0 ? 7.6 : -12.4, -1, s > 0 ? 12.4 : -7.6, -.2, glass[2]); }
    for (let y = 7; y < 14; y += 2.4) rect(-3.6, y, 3.6, y + .8, P.armor[2]);
    orb(X, 0, 0, 4, ['#4a3008','#c08a1a','#ffd27a','#fff8e0']);
    X.globalAlpha = pulse; X.strokeStyle = '#ffd27a'; X.lineWidth = .9; X.beginPath(); X.arc(0, 0, 5.2, 0, TAU); X.stroke(); X.globalAlpha = 1;
  } else if (id==='phantom'){
    // phantom: a faceted black hull with a violet slit sensor
    poly([0,-16.4, 5.6,-8, 5.6,12, 2.4,15.6, -2.4,15.6, -5.6,12, -5.6,-8], ink);
    poly([0,-15, 4.8,-7.6, 4.8,11.6, 2,14.8, -2,14.8, -4.8,11.6, -4.8,-7.6], '#1c1c26');
    poly([0,-15, 4.8,-7.6, 4.8,11.6, 0,14.8], '#14141c');
    X.strokeStyle = '#34344a'; X.lineWidth = .5; X.beginPath(); X.moveTo(-4.8,-7.6); X.lineTo(0,-4); X.lineTo(4.8,-7.6); X.moveTo(0,-4); X.lineTo(0,12); X.stroke();
    X.globalAlpha = .4 + .4*pulse; rect(-4, -1.2, 4, 1.2, '#c070ff'); X.globalAlpha = 1; rect(-3, -.4, 3, .4, '#f0d8ff');
  }
}
// Hangar craft (fighters and bombers, on either side) are tiny pixel-art sprites, not block grids; their single block still
// takes the hits, so they flash when struck and darken as they wear. The nose points to local -y; one sprite pixel is one world unit.
// o outline, h hull, d shade, c cockpit glass, e engine
export const CRAFT_PIX: Record<CraftKind, string[]> = {
  fbay:[
    '...o...',
    '..oho..',
    '..ocho.',
    '.ohhho.',
    'ohdhdho',
    'od.h.do',
    'o.e.e.o',
  ],
  bbay:[
    '....ooo....',
    '...ohcho...',
    '.oodhhhdoo.',
    'ohhhhhhhhho',
    'ohdhhdhhdho',
    '.o.e...e.o.',
  ],
};
const craftSprites = new Map<string, HTMLCanvasElement>(), modCraft = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();
export function craftSprite(k: CraftKind, foe: boolean, mode: 'n' | 'hit' | 'dark', flame: number){
  const mod = sprTinted(`craft/${k}`, foe ? tintFor('e', 'craft') : undefined);
  if (mod){
    // a modded craft: struck it flashes white, worn it darkens, keeping its outline (kept per picture, so an edit shows at once)
    let set = modCraft.get(mod); if (!set) modCraft.set(mod, set = []);
    const m = mode==='n' ? 0 : mode==='hit' ? 1 : 2; if (set[m]) return set[m];
    const c = document.createElement('canvas'); c.width = mod.width; c.height = mod.height;
    const g = c.getContext('2d')!; g.drawImage(mod, 0, 0);
    if (mode !== 'n'){ g.globalCompositeOperation = 'source-in'; g.fillStyle = mode==='hit' ? '#ffffff' : '#000000'; g.fillRect(0, 0, c.width, c.height); }
    return set[m] = c;
  }
  const key = `${k}${foe}${mode}${flame}`;
  let c = craftSprites.get(key); if (c) return c;
  const P = CRAFT_PIX[k], w = P[0].length, h = P.length;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const pal: Record<string, string> = foe
    ? {o:'#5a1008', h:'#ff7a66', d:'#a83a2e', c:'#ffd6cc', e:flame ? '#fff0c0' : '#ffb27a'}
    : {o:'#0a1830', h:'#bcd0f5', d:'#5a78b8', c:'#7fe8ff', e:flame ? '#fff0c0' : '#ffb27a'};
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    const ch = P[y][x]; if (ch === '.') continue;
    g.fillStyle = mode==='hit' && ch !== 'o' ? '#ffffff' : mode==='dark' ? '#000000' : pal[ch];
    g.fillRect(x, y, 1, 1);
  }
  craftSprites.set(key, c); return c;
}
function drawCraft(s: Ship){
  const k = s.kind!, foe = s.team==='e';
  let hp = 0, max = 0, hit = false;
  for (const b of s.blocks.values()){ hp += b.hp; max += b.max; if (G.time - b.hit < .06) hit = true; }
  const spr = craftSprite(k, foe, hit ? 'hit' : 'n', ((G.time*14)|0) & 1), w = spr.width, h = spr.height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, -w/2, -h/2, w, h);
  // wear: darker as the block loses hit points
  const wear = 1 - hp/Math.max(1, max);
  if (!hit && wear > .15){ ctx.globalAlpha = wear*.55; ctx.drawImage(craftSprite(k, foe, 'dark', 0), -w/2, -h/2, w, h); ctx.globalAlpha = 1; }
}
export function drawShip(s: Ship){
  const z = G.zoom, p = G.player!, X0 = (s.x-G.camX)*z + W/2 + (G.camOX||0), Y0 = (s.y-G.camY)*z + H/2 + (G.camOY||0);
  // space jump: still in hyperspace, a flicker marks the arrival point; then the ship rushes in, stretched along its path
  const warp = s.warp || 0, wa = s.warpA || 0;
  if (warp > WARP){
    const r = (s.r*.6 + 6)*z*(.6 + .4*Math.sin(G.time*30));
    ctx.globalAlpha = .5; ctx.strokeStyle = '#a8ecff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X0, Y0, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    return;
  }
  const wk = warp/WARP, D = wk ? (1400*G.SC + s.r*6)*wk*wk*wk*z : 0, ux = Math.cos(wa), uy = Math.sin(wa), X = X0 + ux*D, Y = Y0 + uy*D;
  if (wk){
    // light streaks trailing back along the jump line, fanned across the hull's width
    const len = D*.8 + (240*G.SC + s.r*4)*z*wk, w = s.r*z;
    ctx.lineWidth = 1;
    for (let q=0; q<7; q++){
      const off = (q/6 - .5)*1.6*w, l = len*(.5 + .5*Math.abs(Math.sin(q*7.3 + G.time*40)));
      ctx.globalAlpha = .25 + .5*(1-wk); ctx.strokeStyle = q%3 ? '#a8ecff' : q%2 ? '#ffffff' : '#c8b0ff';
      ctx.beginPath(); ctx.moveTo(X - uy*off, Y + ux*off); ctx.lineTo(X - uy*off + ux*l, Y + ux*off + uy*l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(X, Y);
  if (wk){ ctx.rotate(wa); ctx.scale(1 + 4*wk, 1 - .55*wk); ctx.rotate(-wa); ctx.globalAlpha = .45 + .55*(1-wk); }
  ctx.rotate(s.a); ctx.scale(z,z);
  ctx.lineWidth = 1/z;
  if (s.kind){ drawCraft(s); ctx.restore(); return; }
  const aim = (s.team==='p' ? Math.atan2(G.aim.y-s.y, G.aim.x-s.x) : s.team==='a' ? s.aimA : Math.atan2(p.y-s.y, p.x-s.x)) - s.a;
  if (s.team==='e'){
    // bright rim around enemy hulls so they stand out in a crowd and against smoke
    const m = 1.5/z;
    ctx.fillStyle = s.boss || s.elite ? '#ffd04a' : '#ff5a3a';
    for (const b of s.blocks.values()) ctx.fillRect(b.i*BS-5-m, b.j*BS-5-m, 10+2*m, 10+2*m);
  }
  // mid-roll the ship flickers half see-through
  const ghost = (s.ghost || 0) > G.time || (s === G.player && G.cloakT > G.time);
  // the hull first, then the weapons on their mounts over it
  for (const b of s.blocks.values()){
    if (ghost) ctx.globalAlpha = .45 + .2*Math.sin(G.time*50);
    drawBlock(ctx, b.t, b.o, s.team, b.i*BS, b.j*BS, aim, G.time-b.hit < .05, b.hp/b.max, b.firing, isArm(b.t) ? 'base' : undefined);
  }
  for (const b of s.blocks.values()) if (isArm(b.t)){
    if (ghost) ctx.globalAlpha = .45 + .2*Math.sin(G.time*50);
    // the player's turrets point where they have swung to on their mounts
    drawBlock(ctx, b.t, b.o, s.team, b.i*BS, b.j*BS, s.team==='p' && b.tr != null ? FA[b.o] + (b.ao || 0) + b.tr : aim, G.time-b.hit < .05, b.hp/b.max, b.firing, 'arm', b.mk, b.ao || 0);
  }
  if (s === G.player) drawCockpit(ctx, G.cockpit, k => s.blocks.has(k)); // the cockpit sprite over its whole footprint
  ctx.globalAlpha = 1;
  // ion-jammed weapons flicker violet
  for (const b of s.blocks.values()) if ((b.jam || 0) > G.time){
    ctx.globalAlpha = .35 + .3*Math.sin(G.time*40 + b.i*3); ctx.fillStyle = '#a070ff'; ctx.fillRect(b.i*BS-5, b.j*BS-5, 10, 10); ctx.globalAlpha = 1;
  }
  // goo and hacking modules stuck to the hull
  if (s.stuck) for (const q of s.stuck){
    const b = s.blocks.get(q.k); if (!b || q.t <= G.time) continue;
    const x = b.i*BS + q.ox, y = b.j*BS + q.oy, fade = Math.min(1, (q.t - G.time)/.8), foe = s.team==='p';
    ctx.globalAlpha = fade;
    if (q.kind==='goo'){
      const h = (q.ox*7.3 + q.oy*3.1) & 3;
      ctx.fillStyle = foe ? BCOL.egoo : BCOL.goo; ctx.fillRect(x-1.5, y-1, 3, 2); ctx.fillRect(x-1, y-1.5, 2, 3);
      ctx.fillRect(x + (h&1 ? 1.5 : -2.5), y + (h&2 ? 1 : -2), 1, 1); ctx.fillRect(x - .5, y + 1.5, 1, 1 + (h&1));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x-1, y-1, .8, .8);
    } else {
      ctx.strokeStyle = foe ? BCOL.ehack : BCOL.hack; ctx.lineWidth = .6; ctx.beginPath();
      for (const sy of [-1, 1]) for (const sx of [-1, 1]){ ctx.moveTo(x + sx*1.2, y + sy*1.2); ctx.lineTo(x + sx*2.8, y + sy*2.2); }
      ctx.stroke(); ctx.fillStyle = '#1a1e24'; ctx.fillRect(x-1.8, y-1.5, 3.6, 3);
      ctx.fillStyle = Math.sin(G.time*10 + x) > 0 ? (foe ? BCOL.ehack : BCOL.hack) : '#ffffff'; ctx.fillRect(x-.5, y-.5, 1, 1);
      // interference: a flicker of static across the hacked block
      if (Math.sin(G.time*23 + x*5) > .7){ ctx.globalAlpha = .35*fade; ctx.fillRect(b.i*BS-5, b.j*BS-1 + Math.sin(G.time*31)*3, 10, 1); }
    }
    ctx.globalAlpha = 1;
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
// enemy rounds share the shape of the player's matching weapon, only the hue differs
export const SHAPE: Partial<Record<BulletKind, BulletKind>> = {eoval:'oval', egat:'line', emiss:'miss', eflak:'flak', snipe:'oval', egoo:'goo', ehack:'hack'};
// A round in flight with its glow (all but the hairline tracers), at x, y heading along ang; s is its size in pixels,
// small draws a light cannon shell a little under its hit size, len is a core-gun tracer's length.
export function bulletHead(X: Ctx, kind: BulletKind, x: number, y: number, s: number, ang: number, wf = 0, small = false, len = 5){
  const k = SHAPE[kind] || kind, ca = Math.cos(ang), sa = Math.sin(ang);
  if (k!=='shot'){ X.globalCompositeOperation = 'lighter'; X.globalAlpha = .3; X.fillStyle = BCOL[kind]; X.beginPath(); X.arc(x, y, wf ? s*1.4+1 : s*2.6+1, 0, TAU); X.fill(); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; }
  if (k==='miss' || k==='mirv' || k==='torp'){
    const w = k==='mirv' || k==='torp' ? .75 : .5;
    X.fillStyle = BCOL[kind]; X.beginPath(); X.ellipse(x, y, wf ? s*1.5 : s*2.2, Math.max(.6, s*w), ang, 0, TAU); X.fill();
    X.fillStyle = '#ffffff'; X.fillRect(Math.round(x + ca*s*1.6), Math.round(y + sa*s*1.6), 1, 1);
  } else if (k==='ion'){
    // ion bolt: a flickering violet-white orb wrapped in crackling sparks, nothing like a cannon slug
    const R = s*1.6 + 1;
    X.fillStyle = BCOL.ion; X.beginPath(); X.arc(x, y, R, 0, TAU); X.fill();
    X.fillStyle = '#ffffff'; X.beginPath(); X.arc(x, y, R*.5, 0, TAU); X.fill();
    X.strokeStyle = '#e8dcff'; X.lineWidth = 1; X.beginPath();
    for (let q=0; q<3; q++){ const a = rand(0,TAU), r2 = R*rand(1.6,2.6); X.moveTo(x + Math.cos(a)*R, y + Math.sin(a)*R); X.lineTo(x + Math.cos(a+rand(-.5,.5))*r2*.7, y + Math.sin(a+rand(-.5,.5))*r2*.7); X.lineTo(x + Math.cos(a)*r2, y + Math.sin(a)*r2); }
    X.stroke();
  } else if (k==='goo'){
    // a wobbling glob of goo with two droplets trailing behind
    const R = s*1.3 + .7, w = Math.sin(G.time*14 + x)*.25;
    X.fillStyle = BCOL[kind]; X.beginPath(); X.ellipse(x, y, R*(1 + w), R*(1 - w), ang, 0, TAU); X.fill();
    X.fillRect(Math.round(x - ca*R*2), Math.round(y - sa*R*2), 1, 1); X.fillRect(Math.round(x - ca*R*3.2 + sa), Math.round(y - sa*R*3.2 - ca), 1, 1);
    X.fillStyle = '#ffffff'; X.fillRect(Math.round(x + ca*R*.3 - sa*R*.3), Math.round(y + sa*R*.3 + ca*R*.3), 1, 1);
  } else if (k==='hack'){
    // a hacking module: a dark box with four grabbing legs and a blinking light
    const q = s*1.2 + .8;
    X.save(); X.translate(x, y); X.rotate(ang);
    X.strokeStyle = BCOL[kind]; X.lineWidth = .7; X.beginPath();
    for (const sy of [-1, 1]) for (const sx of [-1, 1]){ X.moveTo(sx*q*.6, sy*q*.6); X.lineTo(sx*q*1.5, sy*q*1.1); }
    X.stroke(); X.fillStyle = '#1a1e24'; X.fillRect(-q, -q*.8, 2*q, 1.6*q);
    X.fillStyle = Math.sin(G.time*12) > 0 ? BCOL[kind] : '#ffffff'; X.fillRect(-.5, -.5, 1, 1);
    X.restore();
  } else if (k==='slug'){
    // Goliath slug: a blunt, fat nose tapering to a narrow tail, a white-hot face and three heavy speed lines behind
    const q = s;
    X.strokeStyle = BCOL.slug; X.globalAlpha = .5; X.lineWidth = .8;
    for (const side of [-1, 0, 1]){ const ox = -sa*side*q*.6, oy = ca*side*q*.6; X.beginPath(); X.moveTo(x - ca*q*2.6 + ox, y - sa*q*2.6 + oy); X.lineTo(x - ca*q*(side ? 8 : 11) + ox, y - sa*q*(side ? 8 : 11) + oy); X.stroke(); }
    X.globalAlpha = 1;
    X.save(); X.translate(x, y); X.rotate(ang);
    X.fillStyle = BCOL.slug; X.beginPath(); X.moveTo(-q*2.5, -q*.3); X.lineTo(q*.5, -q*.85); X.arc(q*.5, 0, q*.85, -Math.PI/2, Math.PI/2); X.lineTo(-q*2.5, q*.3); X.closePath(); X.fill();
    X.fillStyle = '#ffffff'; X.beginPath(); X.arc(q*.75, 0, q*.55, -Math.PI/2, Math.PI/2); X.lineTo(q*.2, q*.4); X.lineTo(q*.2, -q*.4); X.closePath(); X.fill();
    X.restore();
  } else if (k==='oval'){
    // cannon shells are drawn a little under their hit size; Goliath shells at full size; two speed lines trail each
    const q = small ? s*.82 : s;
    X.strokeStyle = BCOL[kind]; X.globalAlpha = .55; X.lineWidth = .6;
    for (const side of [-1, 1]){ const ox = -sa*side*q*.7, oy = ca*side*q*.7; X.beginPath(); X.moveTo(x - ca*q*2.2 + ox, y - sa*q*2.2 + oy); X.lineTo(x - ca*q*7 + ox, y - sa*q*7 + oy); X.stroke(); }
    X.globalAlpha = 1;
    X.fillStyle = BCOL[kind]; X.beginPath(); X.ellipse(x, y, q*2.2, q*1.1, ang, 0, TAU); X.fill();
    X.fillStyle = '#ffffff'; X.beginPath(); X.ellipse(x + ca*q*.5, y + sa*q*.5, q*1.1, q*.5, ang, 0, TAU); X.fill();
  } else if (k==='shot'){
    // the core gun's round: a gatling-style tracer, but a whole game pixel thick with a white-hot tip
    X.strokeStyle = BCOL.shot; X.lineWidth = 1.4; X.beginPath(); X.moveTo(x - ca*len, y - sa*len); X.lineTo(x, y); X.stroke();
    X.fillStyle = '#ffffff'; X.fillRect(x, y, 1, 1);
  } else {
    X.fillStyle = BCOL[kind]; X.fillRect(x-s, y-s+1, 2*s, 2*s-2); X.fillRect(x-s+1, y-s, 2*s-2, 2*s);
    if (s > 1){ X.fillStyle = '#ffffff'; const c = Math.max(1, s>>1); X.fillRect(x-c, y-c, 2*c, 2*c); }
  }
}
export function renderCombat(){
  const S = G.S, p = G.player!;
  // never so far out that a block shrinks under two pixels; off-screen hostiles get edge arrows
  G.zoom = Math.max(.2, Math.min(W,H)/Math.max(closeSpan(p.r), (G.fit || G.span || spanFor(p.r, S))*G.camMul));
  const z = G.zoom, hw = W/2/z, hh = H/2/z;
  let cx = G.camX, cy = G.camY;
  cx = G.AW < 2*hw ? G.AW/2 : clamp(cx, hw, G.AW-hw);
  cy = G.AH < 2*hh ? G.AH/2 : clamp(cy, hh, G.AH-hh);
  G.camX = cx; G.camY = cy;
  const ox = G.shake > .3 && !G.calm ? Math.round(rand(-G.shake,G.shake)) : 0, oy = G.shake > .3 && !G.calm ? Math.round(rand(-G.shake,G.shake)) : 0;
  const sx = (x: number) => (x-cx)*z + W/2 + ox, sy = (y: number) => (y-cy)*z + H/2 + oy;
  G.camOX = ox; G.camOY = oy;

  drawSpace(cx, cy, z);
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

  // railgun slugs in flight: a white-hot head with a violet trail behind it
  for (const S of G.slugs){
    const hx = S.ox + S.dx*S.d, hy = S.oy + S.dy*S.d, tl = Math.min(S.d, 120*G.SC);
    ctx.strokeStyle = '#b9a8f0'; ctx.lineWidth = 2; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(sx(hx - S.dx*tl), sy(hy - S.dy*tl)); ctx.lineTo(sx(hx), sy(hy)); ctx.stroke();
    ctx.globalAlpha = .25; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx(S.ox), sy(S.oy)); ctx.lineTo(sx(hx), sy(hy)); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sx(hx), sy(hy), 2, 0, TAU); ctx.fill();
  }
  // railguns charging: a violet glow swells at the muzzle and energy lines pull in
  if (p && p.alive) for (const h of p.rails) if (h.chg && h.chg > G.time){
    const k = 1 - (h.chg - G.time)/RAIL_CHARGE, [wx, wy] = wpos(p, h), f = p.a + FA[h.o], X = sx(wx + Math.cos(f)*BS*.7), Y = sy(wy + Math.sin(f)*BS*.7);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + .6*k; ctx.fillStyle = '#b48cff';
    ctx.beginPath(); ctx.arc(X, Y, (1.5 + 5*k)*z, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#efe6ff'; ctx.lineWidth = 1;
    for (let q=0; q<5; q++){ const a = q*TAU/5 + G.time*6, r0 = (14 - 10*k)*z, r1 = r0*.45; ctx.beginPath(); ctx.moveTo(X + Math.cos(a)*r0, Y + Math.sin(a)*r0); ctx.lineTo(X + Math.cos(a)*r1, Y + Math.sin(a)*r1); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
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
    } else if (b.kind==='elaser' || b.kind==='eglim'){
      // enemy beams: a hot red Sunspear with a white core, a pale amber Glimmer
      const w = b.kind==='elaser' ? Math.max(2, 2.6*z) : Math.max(1, 1.4*z);
      ctx.globalAlpha = .85; ctx.strokeStyle = b.kind==='elaser' ? '#ff4a2a' : '#ffd890'; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(sx(b.x1),sy(b.y1)); ctx.lineTo(sx(b.x2),sy(b.y2)); ctx.stroke();
      if (b.kind==='elaser'){ ctx.strokeStyle = '#fff0e0'; ctx.lineWidth = Math.max(1, w*.35); ctx.stroke(); }
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
      // the last second fades it out
      ctx.save(); ctx.translate(X,Y); ctx.rotate(f.a); ctx.globalAlpha = Math.min(1, f.life);
      if (f.t && f.team){ ctx.scale(z*.9, z*.9); drawBlock(ctx, f.t, 0, f.team, 0, 0, -Math.PI/2, false, .3); }
      else { ctx.fillStyle = '#2a2e36'; ctx.fillRect(-h,-h,2*h,2*h); ctx.fillStyle = f.col; ctx.fillRect(-h,-h,2*h-1,2*h-1); }
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (f.k==='smoke' && f.col){
      // missile-trail smoke: a 1-2 pixel speck that fades where it hangs
      const q = 1;
      ctx.globalAlpha = a*.55; ctx.fillStyle = f.col; ctx.fillRect(Math.round(sx(f.x)), Math.round(sy(f.y)), q, q);
    } else if (f.k==='smoke'){
      ctx.globalAlpha = a*.35; ctx.fillStyle = '#5a6488';
      ctx.beginPath(); ctx.arc(Math.round(sx(f.x)), Math.round(sy(f.y)), Math.max(1, f.r*z*(1.6-a*.6)), 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // weapon reach, in each weapon's group colour: weapons that fire all round get one faint ring per type around the ship;
  // turrets and beams get their firing arc, a wedge out from the weapon to its range
  if (p && p.alive){
    const seen = new Set<Cell>();
    ctx.lineWidth = 1;
    for (const b of [...p.guns, ...p.rails, ...p.lasers, ...p.teslas, ...p.pds]){
      const d = def(b.t)!, r = d.pd ? d.pd.range*Math.sqrt(G.S)*cockpit().range : rangeOf(b.t as BlockType)*G.SC*rangeMul(b.t)*boost(p, b).rng*(turns(b.t) ? traverse(b.t, b.mk).rng : 1); if (!r) continue;
      const col = b.t==='core' ? '#ffffff' : d.pd ? '#c9adff' : GCOL[grpOf(K(b.i,b.j), b.t)-1], rr = r*z;
      const arc = turns(b.t) ? traverse(b.t, b.mk).arc : d.gun ? cpArc(d.gun.arc ?? Math.PI) : d.laser?.arc ? cpArc(d.laser.arc) : d.rail || d.laser ? SWING : Math.PI;
      ctx.strokeStyle = ctx.fillStyle = col;
      if (arc >= Math.PI - .01){
        if (seen.has(b.t)) continue; seen.add(b.t);
        ctx.setLineDash([2,6]); ctx.globalAlpha = .13; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), rr, 0, TAU); ctx.stroke();
        continue;
      }
      const [wx, wy] = wpos(p, b), X = sx(wx), Y = sy(wy), f = p.a + FA[b.o] + (b.ao || 0);
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.arc(X, Y, rr, f - arc, f + arc); ctx.closePath();
      ctx.setLineDash([]); ctx.globalAlpha = .035; ctx.fill();
      ctx.setLineDash([2,6]); ctx.globalAlpha = .12; ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  for (const s of G.ships) if (s.alive) drawShip(s);
  drawHazard(ctx, sx, sy, z, W, H);

  // the cockpit ability's cooldown: a ring round the ship fills up as it recharges, then flashes once when ready
  if (p && p.alive && !(p.warp || 0)){
    const C = cockpit(), k = 1 - Math.max(0, G.abT)/C.abCd, X = sx(p.x), Y = sy(p.y), r = p.r*z + 6;
    if (k < 1){
      ctx.lineWidth = 1; ctx.globalAlpha = .25; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .9; ctx.strokeStyle = '#ff8a00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r, -Math.PI/2, -Math.PI/2 + k*TAU); ctx.stroke();
    } else if (G.abT > -.35){ ctx.globalAlpha = 1 + G.abT/.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r + 4*(-G.abT/.35), 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // life bars over damaged enemy ships (the capital ship's sits in the HUD)
  for (const e of G.ships){
    if (!e.alive || e.team!=='e' || e === G.boss || e.life >= e.lifeMax) continue;
    const w = Math.max(14, Math.min(60, e.r*z*1.4)), X = Math.round(sx(e.x) - w/2), Y = Math.round(sy(e.y) - e.r*z - 8), k = Math.max(0, e.life/e.lifeMax);
    ctx.fillStyle = '#000000'; ctx.fillRect(X-1, Y-1, w+2, 4);
    ctx.fillStyle = k < .35 ? '#ff5a3a' : '#ffc46b'; ctx.fillRect(X, Y, Math.round(w*k), 2);
  }

  // enemy shield bubbles
  for (const e of G.ships){
    if (!e.alive || e.team!=='e' || !e.shields || !e.shields.length || e.warp) continue;
    for (const sb of e.shields){
      const B = sb.bub!; if (B.down > 0 || B.hp <= 0) continue;
      const [wx,wy] = wpos(e,sb), fl = G.time - B.flash < .08;
      ctx.globalAlpha = fl ? 1 : .2 + .5*B.hp/B.max; ctx.strokeStyle = fl ? '#ffffff' : '#ff9a5a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx(wx), sy(wy), ESH.rad*z, 0, TAU); ctx.stroke();
      if (fl && B.ha != null) hexFlash(ctx, sx(wx), sy(wy), ESH.rad*z, B.ha, '#ffd0b0');
    }
  }
  ctx.globalAlpha = 1;

  // lasers and shields of the player
  if (p && p.alive){
    for (const h of p.lasers){
      if (!h.beam) continue;
      const [a1,b1,a2,b2] = h.beam;
      // the beam fades with distance, as its damage does
      const X1 = sx(a1), Y1 = sy(b1), X2 = sx(a2), Y2 = sy(b2), fade = (rgb: string, a: number) => {
        const gr = ctx.createLinearGradient(X1, Y1, X2, Y2); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},${a*.08})`); return gr; };
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X2, Y2);
      // the Glimmer's beam is thinner and paler than the Sunspear's
      const glm = h.t==='glimmer';
      ctx.strokeStyle = fade(glm ? '205,245,195' : '157,255,138', glm ? .22 : .35); ctx.lineWidth = glm ? 2 : 3; ctx.stroke();
      ctx.strokeStyle = fade(glm ? '240,255,236' : '234,255,228', (glm ? .45 : .7) + .3*Math.random()); ctx.lineWidth = 1; ctx.stroke();
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
      if (fl && B.ha != null) hexFlash(ctx, X, Y, r, B.ha, '#e8fbff');
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 1;
  }

  // explosions and floating text
  for (const f of G.fx){
    const a = clamp(f.life/f.max, 0, 1);
    if (f.k==='boom'){
      if ((f.d || 0) > 0) continue; // not gone off yet
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
    } else if (f.k==='star'){
      // muzzle starburst: sharp spikes, the longest along the shot
      const X = sx(f.x), Y = sy(f.y), r = Math.max(2, f.r*z*(.6 + .4*a));
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = '#fff2b0';
      for (let q=0; q<6; q++){
        const an = f.a + q*TAU/6, L = q===0 ? r*1.8 : r*(q%2 ? .65 : 1);
        ctx.beginPath(); ctx.moveTo(X + Math.cos(an)*L, Y + Math.sin(an)*L); ctx.lineTo(X + Math.cos(an+1.4)*r*.2, Y + Math.sin(an+1.4)*r*.2); ctx.lineTo(X + Math.cos(an-1.4)*r*.2, Y + Math.sin(an-1.4)*r*.2); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (f.k==='txt'){
      ctx.globalAlpha = a; ctx.fillStyle = '#ffc46b'; ctx.font = FONT(8); ctx.textAlign = 'center';
      ctx.fillText(f.text, Math.round(sx(f.x)), Math.round(sy(f.y)));
    }
  }
  ctx.globalAlpha = 1;

  // sparks and bullets on top, snapped to whole pixels: coloured block with a white hot centre
  for (const f of G.fx) if (f.k==='spk'){ ctx.globalAlpha = f.life/f.max; ctx.fillStyle = f.col; ctx.fillRect(Math.round(sx(f.x)), Math.round(sy(f.y)), 1, 1); }
  ctx.globalAlpha = 1;
  const drawB = (arr: Bullet[]) => {
    for (const b of arr){
      const k = SHAPE[b.kind] || b.kind;
      const X = Math.round(sx(b.x)), Y = Math.round(sy(b.y)), s = Math.max(1, Math.round(b.r*z));
      if (X < -s*4 || Y < -s*4 || X > W+s*4 || Y > H+s*4) continue;
      if (b.tr && b.tr.length > 2){
        // exhaust trail: fades from hot yellow at the missile to dim orange at the tail; a weaving warhead's is white smoke behind a hot tip
        const n = b.tr.length/2; ctx.lineWidth = 1;
        if (b.wf){
          // swarm warheads fly in dozens: their trail goes out as four strokes, fading toward the tail, not one per segment
          for (let g=0; g<4; g++){
            const q0 = Math.floor(g*(n-1)/4), q1 = Math.floor((g+1)*(n-1)/4); if (q1 <= q0) continue;
            ctx.globalAlpha = (g+1)*.2; ctx.strokeStyle = g===3 ? '#ffe08a' : '#dfe4ee'; ctx.beginPath();
            for (let q=q0; q<=q1; q++){ const X = Math.round(sx(b.tr[2*q]))+.5, Y = Math.round(sy(b.tr[2*q+1]))+.5; if (q===q0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y); }
            ctx.stroke();
          }
        } else for (let q=1; q<n; q++){
          ctx.globalAlpha = q/n*.9; ctx.strokeStyle = q > n*.6 ? '#ffe08a' : '#ff8a4a';
          ctx.beginPath(); ctx.moveTo(Math.round(sx(b.tr[2*q-2]))+.5, Math.round(sy(b.tr[2*q-1]))+.5); ctx.lineTo(Math.round(sx(b.tr[2*q]))+.5, Math.round(sy(b.tr[2*q+1]))+.5); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      const ang = Math.atan2(b.vy,b.vx);
      if (k==='line'){
        // hairline tracer on the full-resolution layer, one screen pixel wide
        const len = Math.max(5, b.sp*z*.019)*PX, hx = sx(b.x)*PX, hy = sy(b.y)*PX;
        hctx.moveTo(hx - Math.cos(ang)*len, hy - Math.sin(ang)*len); hctx.lineTo(hx, hy);
        continue;
      }
      if (hasSpr('bullet/'+b.kind)) blit(ctx, 'bullet/'+b.kind, X, Y, ang + Math.PI/2, s);
      else bulletHead(ctx, b.kind, X, Y, s, ang, b.wf, b.kind==='oval' && b.r < 3.5*G.SC, Math.max(5, b.sp*z*.019));
    }
  };
  hctx.setTransform(DPR,0,0,DPR,0,0); hctx.clearRect(0,0,innerWidth,innerHeight);
  // tracers: shorter and a touch heavier than a hairline
  hctx.lineWidth = 1.6;
  hctx.strokeStyle = BCOL.line; hctx.beginPath(); drawB(G.pb); hctx.stroke();
  hctx.strokeStyle = BCOL.egat; hctx.beginPath(); drawB(G.eb); hctx.stroke();

  // impact frame: a warship going down flips the picture to its negative for a few frames
  if (G.impT > 0){ ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }

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

  if (G.aimAuto){ ctx.fillStyle = '#e2ecff'; ctx.font = FONT(8); ctx.textAlign = 'left'; ctx.fillText('AUTO-AIM', 8, H - 10); }
  // Shift aiming: a faint reminder while it is off; held, a gold line ties the nose to the mouse
  if (G.mouse.has && !G.joy && p.alive){
    const on = keys.ShiftLeft || keys.ShiftRight, ly = H - (G.aimAuto ? 22 : 10);
    if (on){
      const px = sx(p.x), py = sy(p.y), mx = G.mouse.x, my = G.mouse.y;
      ctx.strokeStyle = '#ffc46b'; ctx.lineWidth = 1; ctx.globalAlpha = .55; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // small print on the full-resolution layer, so it stays a quiet footnote
    hctx.font = FONT(8); hctx.textAlign = 'left'; hctx.fillStyle = on ? '#ffc46b' : '#e2ecff'; hctx.globalAlpha = on ? 1 : .45;
    // the cockpit ability and its cooldown, just above
    const C = cockpit(), rdy = G.abT <= 0;
    hctx.fillStyle = rdy ? '#7fe8ff' : '#8497c4'; hctx.globalAlpha = rdy ? 1 : .7;
    hctx.fillText(`RIGHT-CLICK / E: ${C.abName.split(':')[0].toUpperCase()}${rdy ? '' : ' · ' + Math.ceil(G.abT) + 's'} · Q: TARGET`, 8*PX, ly*PX - 13);
    hctx.fillStyle = on ? '#ffc46b' : '#e2ecff'; hctx.globalAlpha = on ? 1 : .45;
    hctx.fillText(on ? (G.shiftAbs ? 'NOSE ON MOUSE · WASD SCREEN' : 'NOSE ON MOUSE · A/D STRAFE') : 'SHIFT: NOSE FOLLOWS MOUSE', 8*PX, ly*PX); hctx.globalAlpha = 1;
  }

  drawStatus(p);
  drawTargeting(sx, sy);
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

export function layoutBuild(){
  // the grid sits between the parts panel (left) and the ship panel (right); on narrow screens, between the ship panel on top and the parts below
  const lp = $('panel').getBoundingClientRect(), rp = $('inspect').getBoundingClientRect(), top = ($('hud').getBoundingClientRect().bottom + 6)/PX;
  let x0 = 0, y0 = top, x1 = W, y1 = H;
  if (lp.width && rp.width){
    if (rp.left/PX > W*.45){ x0 = (lp.right + 8)/PX; x1 = (rp.left - 8)/PX; }
    else { y0 = Math.max(top, (rp.bottom + 6)/PX); y1 = (lp.top - 8)/PX; }
  }
  const n = 2*buildR() + 1;
  // fit-to-area cell size, times the player's zoom; whole pixels once cells are big enough to stay crisp
  let cs = Math.min(Math.min((x1-x0)*.92, (y1-y0)*.92)/n, 16)*G.bz;
  cs = cs >= 4 ? Math.round(cs) : Math.max(1, cs);
  return {cx:Math.round((x0+x1)/2 + G.bpx), cy:Math.round((y0+y1)/2 + G.bpy), cs, n};
}
export const designType = (k: Key) => G.design.get(k);
// Share of a design turret's firing arc that has a clear line out of the hull (same ray walk as laneClear).
export const aimsOut = (t: Cell) => { const g = def(t)?.gun; return (!!g && !g.homing && !g.lob && t!=='core') || !!def(t)?.laser?.arc; };
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
// a placed weapon (k given) aims through its own mount and angle; one about to be placed through the picked ones
const mkOf = (t: Cell, k?: Key) => k == null ? (t===G.sel && G.selMk && mountFits(t, G.selMk) === true ? G.selMk : undefined) : G.mnt[k];
const arcOf = (t: Cell, k?: Key) => turns(t) ? traverse(t, mkOf(t, k)).arc : cpArc(def(t)?.gun?.arc || def(t)?.laser?.arc || 0);
/** Whether a design weapon fires over the hull: through its mount for a turret. */
const overOf = (t: Cell, k?: Key) => turns(t) ? traverse(t, mkOf(t, k)).over : !!def(t)?.gun?.over;
const midOf = (o: Facing, k?: Key) => FA[o] + (k == null ? G.selAng*ANG_STEP : angAt(k));
export const ARC_N = 16, arcRays = (o: Facing, t: Cell, k?: Key) => Array.from({length:ARC_N}, (_,n) => midOf(o,k) - arcOf(t,k) + 2*arcOf(t,k)*n/(ARC_N-1));
export function arcClear(i: number, j: number, o: Facing, t: Cell, k?: Key){
  if (overOf(t, k)) return 1;
  const R = designR(); let ok = 0;
  for (const a of arcRays(o,t,k)) if (rayOut(i,j,a,R) === Infinity) ok++;
  return ok/ARC_N;
}
// Drydock overlay: a turret's arc as rays (cyan clear, red stopped by own hull); lasers and railguns as a line along their facing.
export function drawArc(i: number, j: number, o: Facing, t: Cell, alpha: number, R: number, len: number, k?: Key){
  const x = i*BS, y = j*BS;
  ctx.globalAlpha = alpha; ctx.lineWidth = ctx.lineWidth || 1;
  if (aimsOut(t)){
    for (const a of arcRays(o,t,k)){
      const h = overOf(t, k) ? Infinity : rayOut(i,j,a,R), L = Math.min(h, len)*BS;
      ctx.strokeStyle = h === Infinity ? '#5fd8ff' : '#ff5a3a';
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x + Math.cos(a)*L, y + Math.sin(a)*L); ctx.stroke();
    }
    ctx.strokeStyle = '#5fd8ff'; ctx.beginPath(); ctx.arc(x, y, len*BS, midOf(o,k) - arcOf(t,k), midOf(o,k) + arcOf(t,k)); ctx.stroke();
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
  ctx.fillText(`${(2*R+1)*M_PER_BLOCK} M`, cx, Tp + size + 12);

  const sc = cs/BS;
  ctx.save(); ctx.translate(cx,cy); ctx.scale(sc,sc); ctx.lineWidth = 1/sc;
  const aR = designR(), aLen = R + 1.5;
  ctx.globalAlpha = .35; ctx.strokeStyle = '#5fd3ff'; ctx.setLineDash([4/sc,3/sc]);
  for (const [k,t] of G.design) if (t==='shield'){ ctx.beginPath(); ctx.arc(KI(k)*BS, KJ(k)*BS, shRad(), 0, TAU); ctx.stroke(); }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // a placed weapon's arc shows strongly while its type or a mount is selected
  for (const [k,t] of G.design) if (aimsOut(t) || BEAM(t)) drawArc(KI(k), KJ(k), G.dirs.get(k) || 0, t, t===G.sel || (T[G.sel]?.mount && turns(t)) ? .35 : .14, aR, aLen, k);
  // the hull first; weapons and their mounts go over all of it, as in a fight
  for (const [k,t] of G.design){
    const i = KI(k), j = KJ(k), o = G.dirs.get(k) || 0, broken = G.broken.has(k);
    drawBlock(ctx, t, o, 'p', i*BS, j*BS, FA[o], false, 1, false, isArm(t) && !broken ? 'base' : undefined);
    // damaged: darkened plate with an orange crack
    if (broken){
      ctx.globalAlpha = .6; ctx.fillStyle = '#000000'; ctx.fillRect(i*BS-5, j*BS-5, 10, 10); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff9a3a'; ctx.beginPath(); ctx.moveTo(i*BS-4,j*BS-3); ctx.lineTo(i*BS-1,j*BS); ctx.lineTo(i*BS+1,j*BS-2); ctx.lineTo(i*BS+4,j*BS+3); ctx.stroke();
    }
  }
  for (const [k,t] of G.design) if (isArm(t) && !G.broken.has(k)){ const o = G.dirs.get(k) || 0; drawBlock(ctx, t, o, 'p', KI(k)*BS, KJ(k)*BS, FA[o] + angAt(k), false, 1, false, 'arm', G.mnt[k], angAt(k)); }
  // support modules: a line in the module's colour to every weapon it feeds, and a pip per module on the weapon
  const fed = designFeeds(), feeding = new Set(fed.flatMap(f => f.mods.map(m => m[0])));
  const link = (m: Key, w: Key, alpha: number) => {
    const col = MODCOL[G.design.get(m) || ''] || '#ffffff', mx = KI(m)*BS, my = KJ(m)*BS, wx = KI(w)*BS, wy = KJ(w)*BS;
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(wx, wy); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(wx + (mx-wx)*.32, wy + (my-wy)*.32, .9, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1/sc;
  };
  for (const f of fed){
    for (const [m,w] of f.mods) link(m, w, .75);
    const x = KI(f.k)*BS, y = KJ(f.k)*BS;
    f.mods.forEach(([m], n) => { ctx.fillStyle = '#05060c'; ctx.fillRect(x-4.7+n*2.2, y+2.5, 2, 2); ctx.fillStyle = MODCOL[G.design.get(m)!]; ctx.fillRect(x-4.4+n*2.2, y+2.8, 1.4, 1.4); });
  }
  for (const [k,t] of G.design){
    if (G.broken.has(k)) continue;
    // a support module touching no weapon does nothing
    if (def(t)?.mod && !feeding.has(k)){ ctx.fillStyle = '#ffc46b'; ctx.fillRect(KI(k)*BS+1.5, KJ(k)*BS-4.5, 3, 3); }
    const i = KI(k), j = KJ(k), o = G.dirs.get(k) || 0;
    // warnings: engine exhaust covered, or a beam weapon looking into its own hull
    const bad = (t==='engine' && designType(K(i-FACE[o][0], j-FACE[o][1]))) || (BEAM(t) && !laneFwd(designType, i, j, o));
    const fc = aimsOut(t) ? arcClear(i, j, o, t, k) : 1;
    if (!bad && fc < .4 && fc > 0){ ctx.fillStyle = '#ffc46b'; ctx.fillRect(i*BS+1.5, j*BS-4.5, 3, 3); }
    if (bad || fc === 0){ ctx.strokeStyle = '#ff7a66'; ctx.beginPath(); ctx.moveTo(i*BS-4,j*BS-4); ctx.lineTo(i*BS+4,j*BS+4); ctx.moveTo(i*BS+4,j*BS-4); ctx.lineTo(i*BS-4,j*BS+4); ctx.stroke(); }
  }
  drawCockpit(ctx, G.cockpit, k => G.design.has(k) && !G.broken.has(k));
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
  let tip: string[] | null = null, tipAt: [number, number] = [0, 0], tipCol = '#e2ecff';
  if (h && !G.grpBrush && Math.max(Math.abs(h.i),Math.abs(h.j)) <= R){
    const hk = K(h.i, h.j), ht = G.design.get(hk);
    tipAt = [h.i, h.j];
    if (T[G.sel]?.mount && ht && !G.broken.has(hk)){
      // fitting a mount: what a click does on this weapon
      const [hi, hj] = headOf(h.i, h.j), head = K(hi, hj), wt = G.design.get(head)!, mk = T[G.sel].mount!, cur = mountAt(head, wt), fit = mountFits(wt, mk);
      tipCol = '#ffc46b';
      tip = [`${T[wt as BlockType]?.name || wt}: ${turns(wt) ? mountText(wt, cur, angAt(head)) : 'aims itself'}`,
        fit !== true ? fit : cur===mk ? 'Click to angle the arc 15° more' : mk===mountFor(wt) ? `Click to put it back on its stock ${MOUNTS[mk].name.toLowerCase()}` : `Click to fit: ${mountText(wt, mk)}`];
    } else if (def(G.sel)?.mod){
      // placing a support module: which weapons it would feed from here
      const hyp = (k: Key) => k===hk ? G.sel : G.broken.has(k) ? undefined : G.design.get(k);
      const now = designFeeds(hyp).filter(f => f.mods.some(([m]) => m===hk));
      for (const f of now) for (const [m,w] of f.mods) if (m===hk) link(m, w, .9);
      tipCol = MODCOL[G.sel];
      tip = [T[G.sel].name, now.length ? `Would boost ${now.map(f => T[f.t as BlockType]?.name || f.t).join(', ')}${now.length > 1 ? `, sharing it ${now.length} ways` : ''}` : 'Boosts nothing here: touch a weapon (corners count)'];
    } else if (ht && !G.broken.has(hk)){
      const [hi, hj] = headOf(h.i, h.j), head = K(hi, hj), wt = G.design.get(head)!, f = fed.find(q => q.k===head);
      if (def(ht)?.mod){
        // a placed module: the weapons it feeds
        const ws = fed.filter(q => q.mods.some(([m]) => m===hk));
        tipCol = MODCOL[ht];
        tip = [T[ht as BlockType].name, ws.length ? `Boosts ${ws.map(q => T[q.t as BlockType]?.name || q.t).join(', ')}${ws.length > 1 ? `, sharing it ${ws.length} ways` : ''}` : 'Boosts nothing: touch a weapon (corners count)'];
      } else if (boostable(wt)){
        tip = [`${T[wt as BlockType]?.name || wt}${turns(wt) ? ': ' + mountText(wt, mountAt(head, wt), angAt(head)) : ''}`];
        // the selected weapon type: a click moves it onto the picked mount and angle, or turns it if it already matches
        if (wt===G.sel && turns(wt)){
          const want = G.selMk && mountFits(wt, G.selMk) === true ? G.selMk : mountFor(wt);
          tip.push(mountAt(head, wt)===want && (G.ang[head] || 0)===G.selAng ? 'Click to turn it 45°' : `Click to move it onto: ${mountText(wt, want, G.selAng*ANG_STEP)}`);
          tipCol = '#ffc46b';
        }
        if (f){ tip.push(`${f.mods.length} module${f.mods.length > 1 ? 's' : ''}: ${boostText(f.B)}`); for (const [m,w] of f.mods) link(m, w, 1); }
      }
    }
    const spots = T[G.sel]?.mount ? [] : placeSpots(h.i,h.j,G.rot,G.sel);
    for (const [i,j,o] of spots){
      if (G.sel==='sell'){ ctx.globalAlpha = .9; drawBlock(ctx,'sell',0,'p',i*BS,j*BS,0,false,1,false); continue; }
      const ok = placeCheck(i,j,G.sel,o) === true, oo = faceFor(G.sel, o);
      for (const [ci,cj,ct] of cellsFor<BlockType>(i,j,G.sel,oo)){
        ctx.globalAlpha = .55; drawBlock(ctx,ct,oo,'p',ci*BS,cj*BS,FA[oo],false,1,false);
        if (ct===G.sel && (aimsOut(ct) || BEAM(ct))) drawArc(ci, cj, oo, ct, .75, aR, aLen);
        if (!ok){ ctx.globalAlpha = .8; ctx.strokeStyle = '#ff7a66'; ctx.strokeRect(ci*BS-5,cj*BS-5,10,10); }
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // the tip is a page element over the top of the build area, so its text stays crisp
  const el = $('buildTip'), key = tip ? tipCol + tip.join('|') : '';
  if (el.dataset.k !== key){
    el.dataset.k = key; el.hidden = !tip; el.style.setProperty('--tc', tipCol);
    el.replaceChildren(...(tip || []).map((l, n) => { const d = document.createElement('div'); if (!n) d.className = 'tt'; d.textContent = l; return d; }));
  }
}
