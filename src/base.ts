import { COL, HEAD_OF } from './catalog';
import { drawSpace } from './draw';
import { KI, KJ, clamp } from './grid';
import { startDesign } from './runs';
import { G } from './state';
import type { BlockType, Cell } from './types';
import { $, H, PX, W, ctx } from './view';

// ---------- the space base ----------
// The main menu is the inside of a space base, drawn as flat-shaded 3D polygons into the low-res game canvas (90s VGA style).
// Four doorways stand in a half circle under a long window onto space; a holotable in the middle shows the starting ship.
// Each doorway is a station: HTML buttons sit over them, so the menu works with mouse, touch and keyboard.

type V3 = [number, number, number];
type RGB = [number, number, number];
/** One polygon: its corners, colour, draw layer (lower first), and whether it glows instead of being lit. */
interface Face { p: V3[]; c: RGB; layer: number; glow?: boolean; st?: number }

export interface Station { id: string; name: string; sub: string; col: RGB }
export const STATIONS: Station[] = [
  {id:'cantina', name:'Cantina', sub:'Records, rumors, the ship deck', col:[127,224,122]},
  {id:'rnd', name:'Research & Development', sub:'Spend data on upgrades', col:[200,138,255]},
  {id:'eng', name:'Engineering', sub:'Design your starting ship', col:[95,216,255]},
  {id:'hangar', name:'Hangar', sub:'Launch a run', col:[255,196,107]},
];

const R = 8, ZC = -1, WALL_H = 6, DOOR_W = 2.4, DOOR_H = 2.8, WIN_LO = 3.6, WIN_HI = 5.4;
const ANG = [-80, -40, 0, 40, 80].map(a => a*Math.PI/180);
const corner = (k: number, y: number): V3 => [R*Math.sin(ANG[k]), y, ZC - R*Math.cos(ANG[k])];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const add = (a: V3, b: V3): V3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul = (a: V3, s: number): V3 => [a[0]*s, a[1]*s, a[2]*s];
const sub = (a: V3, b: V3): V3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const hex = (h: string): RGB => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

const WALL: RGB = [70,78,92], PANEL: RGB = [52,58,70], FLOOR: RGB = [30,34,42], CEIL: RGB = [36,40,48], TRIM: RGB = [96,104,120];
// the static room, built once
let room: Face[] | null = null;
/** Where each doorway's opening is in the world: its four corners, for placing the station buttons. */
const doors: V3[][] = [];
function buildRoom(){
  const F: Face[] = [];
  const quad = (a: V3, b: V3, c: V3, d: V3, col: RGB, layer: number, glow = false, st?: number) => F.push({p:[a,b,c,d], c:col, layer, glow, st});
  // floor and ceiling, with glowing light strips overhead
  quad([-14,0,8],[14,0,8],[14,0,-12],[-14,0,-12], FLOOR, 0);
  quad([-14,WALL_H,-12],[14,WALL_H,-12],[14,WALL_H,8],[-14,WALL_H,8], CEIL, 0);
  for (const x of [-3, 3]) quad([x-.25,WALL_H-.01,-7],[x+.25,WALL_H-.01,-7],[x+.25,WALL_H-.01,6],[x-.25,WALL_H-.01,6], [200,232,255], 1, true);
  // side walls closing the half circle back to the camera
  for (const s of [-1, 1]){
    const k = s < 0 ? 0 : 4, a = corner(k,0), b: V3 = [s*R*1.02, 0, 8];
    quad(a, b, [b[0],WALL_H,b[2]], corner(k,WALL_H), WALL, 1);
  }
  // four wall panels, each with a doorway in its lower half and the window above
  for (let k=0; k<4; k++){
    const a = corner(k,0), b = corner(k+1,0), w = Math.hypot(b[0]-a[0], b[2]-a[2]);
    const u = norm(sub(b,a)), n = norm(cross(u, [0,1,0])); // n points into the room
    const at = (x: number, y: number, d = 0): V3 => add(add(a, mul(u, x)), [n[0]*d, y, n[2]*d]);
    const d0 = (w - DOOR_W)/2, d1 = d0 + DOOR_W, col = STATIONS[k].col;
    // wall around the doorway: two pillars and a lintel, sill and header around the window
    quad(at(0,0), at(d0,0), at(d0,WIN_LO), at(0,WIN_LO), PANEL, 2);
    quad(at(d1,0), at(w,0), at(w,WIN_LO), at(d1,WIN_LO), PANEL, 2);
    quad(at(d0,DOOR_H), at(d1,DOOR_H), at(d1,WIN_LO), at(d0,WIN_LO), PANEL, 2);
    quad(at(0,WIN_LO), at(w,WIN_LO), at(w,WIN_LO+.18,.25), at(0,WIN_LO+.18,.25), TRIM, 3);
    quad(at(0,WIN_HI), at(w,WIN_HI), at(w,WALL_H), at(0,WALL_H), WALL, 2);
    // the doorway: a recess lit in the station's colour, its jambs, and a glowing sign above
    const dim = col.map(v => v*.32) as RGB;
    quad(at(d0,0,-1.4), at(d1,0,-1.4), at(d1,DOOR_H,-1.4), at(d0,DOOR_H,-1.4), dim, 1, false, k);
    quad(at(d0,0), at(d0,0,-1.4), at(d0,DOOR_H,-1.4), at(d0,DOOR_H), WALL, 1);
    quad(at(d1,0,-1.4), at(d1,0), at(d1,DOOR_H), at(d1,DOOR_H,-1.4), WALL, 1);
    quad(at(d0,DOOR_H,-1.4), at(d1,DOOR_H,-1.4), at(d1,DOOR_H), at(d0,DOOR_H), WALL, 1);
    quad(at(d0+.2,DOOR_H+.14,.02), at(d1-.2,DOOR_H+.14,.02), at(d1-.2,DOOR_H+.5,.02), at(d0+.2,DOOR_H+.5,.02), col, 3, true, k);
    // a lit strip along the floor leading into the doorway
    quad(at(d0+.9,.01,-1.3), at(d1-.9,.01,-1.3), at(d1-.9,.01,1.6), at(d0+.9,.01,1.6), col.map(v => v*.55) as RGB, 0, true, k);
    doors[k] = [at(d0,0), at(d1,0), at(d1,DOOR_H), at(d0,DOOR_H)];
  }
  // window mullions at the panel corners
  for (let k=0; k<5; k++){
    const c = corner(k,0), n = norm([-c[0], 0, ZC - c[2]]), t: V3 = [n[2]*.2, 0, -n[0]*.2];
    const p0 = add(c, add(mul(n,.15), mul(t,-1))), p1 = add(c, add(mul(n,.15), t));
    quad(p0, p1, [p1[0],WALL_H,p1[2]], [p0[0],WALL_H,p0[2]], TRIM, 3);
  }
  // the holotable: an eight-sided pedestal with a glowing top
  const hc: V3 = [0,0,1.2], hr = 1.1, top = .9, ring = Array.from({length:8}, (_, i) => i/8*Math.PI*2);
  for (const a of ring){
    const b = a + Math.PI/4, p = (ang: number, y: number, r = hr): V3 => [hc[0] + Math.cos(ang)*r, y, hc[2] + Math.sin(ang)*r];
    quad(p(a,0,hr*.8), p(b,0,hr*.8), p(b,top), p(a,top), PANEL, 4);
  }
  F.push({p:ring.map(a => [hc[0] + Math.cos(a)*hr, top, hc[2] + Math.sin(a)*hr] as V3), c:[40,110,150], layer:4, glow:true});
  room = F;
}

// the camera eases toward the hovered station and drifts with the pointer
const cam = {x:0, y:1.75, z:6.2, yaw:0, pitch:.06};
let hover = -1, mx = 0;
const LIGHT = norm([.4, .9, .5]), FOG: RGB = [10,14,26];
let FL = 1;
/** World point to camera space: right, up, depth. */
function toCam(p: V3): V3 {
  const dx = p[0]-cam.x, dy = p[1]-cam.y, dz = p[2]-cam.z, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const x = dx*cy + dz*sy, z0 = dx*sy - dz*cy, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  return [x, dy*cp - z0*sp, z0*cp + dy*sp];
}
const toScreen = (c: V3): [number, number] => [W/2 + c[0]/c[2]*FL, H/2 - c[1]/c[2]*FL];
// clip a camera-space polygon to the near plane
function clipNear(ps: V3[]): V3[] {
  const N = .1, out: V3[] = [];
  for (let i=0; i<ps.length; i++){
    const a = ps[i], b = ps[(i+1) % ps.length];
    if (a[2] >= N) out.push(a);
    if ((a[2] >= N) !== (b[2] >= N)){ const t = (N - a[2])/(b[2] - a[2]); out.push(lerp3(a, b, t)); }
  }
  return out;
}
function shade(f: Face, depth: number): string {
  let c = f.c;
  if (!f.glow){
    const a = f.p[0], n = norm(cross(sub(f.p[1], a), sub(f.p[2], a))), l = .38 + .62*Math.abs(n[0]*LIGHT[0] + n[1]*LIGHT[1] + n[2]*LIGHT[2]);
    c = c.map(v => v*l) as RGB;
  }
  if (f.st != null && f.st === hover){ const k = .35 + .25*Math.sin(G.time*6); c = c.map(v => Math.min(255, v*(1 + k) + 30*k)) as RGB; }
  const fog = clamp((depth - 6)/26, 0, .7);
  return `rgb(${c.map((v, i) => Math.round(v*(1-fog) + FOG[i]*fog)).join(',')})`;
}
function drawFaces(fs: Face[]){
  const list: {s: [number, number][]; d: number; f: Face}[] = [];
  for (const f of fs){
    const cs = clipNear(f.p.map(toCam)); if (cs.length < 3) continue;
    list.push({s:cs.map(toScreen), d:cs.reduce((a, c) => a + c[2], 0)/cs.length, f});
  }
  list.sort((a, b) => a.f.layer - b.f.layer || b.d - a.d);
  for (const {s, d, f} of list){
    ctx.fillStyle = shade(f, d); ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
    for (let i=1; i<s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
    ctx.closePath(); ctx.fill();
  }
}
// The starting ship as little cubes spinning over the holotable; only faces that no neighbour hides are drawn.
export function holoShip(): Face[] {
  const d: [number, number, Cell][] = startDesign().d.map(([k, t]) => [KI(k), KJ(k), t]);
  let m = 1; for (const [i, j] of d) m = Math.max(m, Math.abs(i), Math.abs(j));
  const s = Math.min(.22, 1.5/(2*m + 1)), yaw = G.time*.5, c = Math.cos(yaw), sn = Math.sin(yaw), cx = 0, cz = 1.2, base = 1.55 + .05*Math.sin(G.time*2);
  const filled = new Set(d.map(([i, j]) => i+','+j)), out: Face[] = [];
  // spin around the vertical, then tip the far side up so the deck faces the viewer
  const ct = Math.cos(.75), st = Math.sin(.75);
  const P = (x: number, y: number, z: number): V3 => { const xr = x*c - z*sn, zr = x*sn + z*c; return [cx + xr, base + y*ct - zr*st, cz + zr*ct + y*st]; };
  for (const [i, j, t] of d){
    const col = hex((COL.p[(HEAD_OF[t as BlockType] || t) as Cell] || COL.p[t] || '#bcd0f5')), x0 = i*s - s/2, x1 = x0 + s, z0 = j*s - s/2, z1 = z0 + s, y0 = -s/2, y1 = s/2;
    out.push({p:[P(x0,y1,z0), P(x1,y1,z0), P(x1,y1,z1), P(x0,y1,z1)], c:col, layer:5});
    if (!filled.has(i+','+(j-1))) out.push({p:[P(x0,y0,z0), P(x1,y0,z0), P(x1,y1,z0), P(x0,y1,z0)], c:col, layer:5});
    if (!filled.has(i+','+(j+1))) out.push({p:[P(x1,y0,z1), P(x0,y0,z1), P(x0,y1,z1), P(x1,y1,z1)], c:col, layer:5});
    if (!filled.has((i-1)+','+j)) out.push({p:[P(x0,y0,z1), P(x0,y0,z0), P(x0,y1,z0), P(x0,y1,z1)], c:col, layer:5});
    if (!filled.has((i+1)+','+j)) out.push({p:[P(x1,y0,z0), P(x1,y0,z1), P(x1,y1,z1), P(x1,y1,z0)], c:col, layer:5});
  }
  return out;
}
export function renderBase(dt: number){
  if (!room) buildRoom();
  FL = Math.min(W*.5, H*.95);
  // ease the camera: a slow sway, a pull toward the hovered doorway, and a little toward the pointer
  const want = (hover >= 0 ? (ANG[hover] + ANG[hover+1])/2*.32 : 0) + mx*.06 + Math.sin(G.time*.3)*.02;
  cam.yaw += (want - cam.yaw)*Math.min(1, dt*3);
  // space through the window, and a planet hanging far out beyond it
  drawSpace(G.time*4, 0, 1);
  const pc = toCam([-30, 26, -140]);
  if (pc[2] > 1){
    const [px, py] = toScreen(pc), pr = 18/pc[2]*FL;
    ctx.fillStyle = '#3a2a5a'; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#6a4a8a'; ctx.beginPath(); ctx.arc(px - pr*.25, py - pr*.25, pr*.8, 0, Math.PI*2); ctx.fill();
  }
  drawFaces([...room!, ...holoShip()]);
  // the holotable's beam of light
  const [bx, by] = toScreen(toCam([0, .9, 1.2])), [tx, ty] = toScreen(toCam([0, 2.1, 1.2])), bw = 1.2/toCam([0, 1.5, 1.2])[2]*FL;
  const g = ctx.createLinearGradient(0, by, 0, ty); g.addColorStop(0, 'rgba(95,216,255,.28)'); g.addColorStop(1, 'rgba(95,216,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - bw*.55, by); ctx.lineTo(bx + bw*.55, by); ctx.lineTo(tx + bw, ty); ctx.lineTo(tx - bw, ty); ctx.closePath(); ctx.fill();
  placeButtons();
}
// keep each station's button over its doorway
function placeButtons(){
  doors.forEach((q, k) => {
    const b = $('st-'+STATIONS[k].id), cs = q.map(toCam);
    if (cs.some(c => c[2] < .2)){ b.style.visibility = 'hidden'; return; }
    const ss = cs.map(toScreen), xs = ss.map(s => s[0]*PX), ys = ss.map(s => s[1]*PX);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    Object.assign(b.style, {visibility:'visible', left:x0+'px', top:y0+'px', width:(Math.max(...xs) - x0)+'px', height:(Math.max(...ys) - y0)+'px'});
  });
}
/** Station button wiring; act opens the station. */
export function initBase(act: (id: string) => void){
  const root = $('base');
  for (const [k, s] of STATIONS.entries()){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'station'; b.id = 'st-'+s.id;
    b.style.setProperty('--sc', `rgb(${s.col.join(',')})`);
    b.innerHTML = `<span><b>${s.name}</b><small>${s.sub}</small></span>`;
    b.addEventListener('pointerenter', () => { hover = k; });
    b.addEventListener('pointerleave', () => { if (hover === k) hover = -1; });
    b.addEventListener('focus', () => { hover = k; });
    b.addEventListener('blur', () => { if (hover === k) hover = -1; });
    b.addEventListener('click', () => act(s.id));
    root.append(b);
  }
  addEventListener('pointermove', e => { mx = e.clientX/innerWidth*2 - 1; });
}
