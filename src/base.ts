import { COL, HEAD_OF } from './catalog';
import { drawSpace } from './draw';
import { KI, KJ, clamp } from './grid';
import { startDesign } from './runs';
import { G } from './state';
import type { BlockType, Cell } from './types';
import { $, DPR, FONT, H, PX, W, ctx, hctx } from './view';

// ---------- the space base ----------
// The main menu is the inside of a space base, drawn as flat-shaded 3D polygons into the low-res game canvas (90s VGA style).
// Four doorways stand in a half circle under a long window onto the station's exterior; a holotable on a dais shows the starting ship.
// Each doorway is a station: HTML buttons sit over them, so the menu works with mouse, touch and keyboard.

type V3 = [number, number, number];
type RGB = [number, number, number];
/**
 * One polygon. Lower layers draw first; within a layer, farther first. n is the outward normal of a box face, used to
 * skip faces turned away from the camera. A glowing face ignores lighting; blink makes it flicker; st ties it to a station.
 */
interface Face { p: V3[]; c: RGB; layer: number; glow?: boolean; n?: V3; blink?: number; st?: number; lit?: RGB }

/** sign: the short name lit on the sign over its doorway */
export interface Station { id: string; name: string; sign: string; col: RGB }
export const STATIONS: Station[] = [
  {id:'cantina', name:'Cantina', sign:'CANTINA', col:[255,210,0]},
  {id:'rnd', name:'Research & Development', sign:'R&D', col:[255,210,0]},
  {id:'eng', name:'Engineering', sign:'ENGINEERING', col:[255,210,0]},
  {id:'hangar', name:'Hangar', sign:'HANGAR', col:[255,210,0]},
];

const R = 8, ZC = -1, WALL_H = 6, DOOR_W = 2.4, DOOR_H = 2.8, WIN_LO = 3.6, WIN_HI = 5.4, DEEP = 3.2, HOLO: V3 = [0, 0, 1.2];
const ANG = [-80, -40, 0, 40, 80].map(a => a*Math.PI/180);
const corner = (k: number, y: number): V3 => [R*Math.sin(ANG[k]), y, ZC - R*Math.cos(ANG[k])];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const add = (a: V3, b: V3): V3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul = (a: V3, s: number): V3 => [a[0]*s, a[1]*s, a[2]*s];
const sub = (a: V3, b: V3): V3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: V3, b: V3) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const scale = (c: RGB, k: number): RGB => [c[0]*k, c[1]*k, c[2]*k];
const hex = (h: string): RGB => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const centre = (ps: V3[]): V3 => mul(ps.reduce(add, [0,0,0] as V3), 1/ps.length);

// the alert look: near-black gunmetal so the orange doorways and signs carry the room
const WALL: RGB = [46,46,50], PANEL: RGB = [36,36,40], DADO: RGB = [22,22,26], FLOOR: RGB = [24,24,28], CEIL: RGB = [26,26,30], TRIM: RGB = [72,72,78];
const DARK: RGB = [12,12,14], RUST: RGB = [96,60,40], HAZ: RGB = [255,138,0], DOOR: RGB = [64,64,70];

// ---------- lighting ----------
// Fixed key light from above, a cool light over the holotable, and each doorway washing the room in its station's colour.
const KEY = norm([.3, 1, .45]);
const LIGHTS: {p: V3; c: RGB; s: number}[] = [{p:[0, 5.2, 1.2], c:[255,170,110], s:.5}];
function light(f: Face): RGB {
  const a = f.p[0], n = f.n || norm(cross(sub(f.p[1], a), sub(f.p[2], a))), c = centre(f.p);
  let k = .3 + .42*Math.abs(dot(n, KEY));
  const out: RGB = scale(f.c, k);
  for (const L of LIGHTS){
    const d = sub(L.p, c), dd = dot(d, d), face = f.n ? Math.max(0, dot(n, norm(d))) : .6, w = L.s*face/(1 + dd*.09);
    for (let i=0; i<3; i++) out[i] += f.c[i]*L.c[i]/255*w*1.2 + L.c[i]*w*.12;
  }
  return out.map(v => Math.min(255, v)) as RGB;
}

// ---------- building blocks ----------
let faces: Face[] = [];
const quad = (a: V3, b: V3, c: V3, d: V3, col: RGB, layer: number, o: Partial<Face> = {}) => { faces.push({p:[a,b,c,d], c:col, layer, ...o}); };
/** A box from its eight corners (four bottom then four top, going round), with outward normals so hidden faces are skipped. */
function box8(q: V3[], col: RGB, layer: number, o: Partial<Face> = {}, skip: string = ''){
  const [b0,b1,b2,b3,t0,t1,t2,t3] = q, mid = centre(q);
  const side = (ps: V3[], key: string) => { if (skip.includes(key)) return; const c = centre(ps); faces.push({p:ps, c:col, layer, n:norm(sub(c, mid)), ...o}); };
  side([t0,t1,t2,t3], 't'); side([b3,b2,b1,b0], 'b');
  side([b0,b1,t1,t0], '0'); side([b1,b2,t2,t1], '1'); side([b2,b3,t3,t2], '2'); side([b3,b0,t0,t3], '3');
}
/** An axis-aligned box. */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: RGB, layer: number, o: Partial<Face> = {}) =>
  box8([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], col, layer, o, 'b');
/** A box stretched between two points, w wide (sideways) and h tall (up). */
function beam(a: V3, b: V3, w: number, h: number, col: RGB, layer: number, o: Partial<Face> = {}){
  const f = norm(sub(b, a)), s0 = norm(cross(f, [0,1,0])), s = Math.hypot(...s0) > .01 ? s0 : [1,0,0] as V3, u = norm(cross(s, f));
  const c = (p: V3, x: number, y: number) => add(p, add(mul(s, x*w/2), mul(u, y*h/2)));
  box8([c(a,-1,-1), c(a,1,-1), c(b,1,-1), c(b,-1,-1), c(a,-1,1), c(a,1,1), c(b,1,1), c(b,-1,1)], col, layer, o);
}
/** An upright many-sided prism, optionally with a differently coloured (or glowing) top. */
function prism(cx: number, cz: number, r: number, y0: number, y1: number, col: RGB, layer: number, sides = 8, top?: Partial<Face> & {c?: RGB}, o: Partial<Face> = {}){
  const ring = Array.from({length:sides}, (_, i) => (i + .5)/sides*Math.PI*2), P = (a: number, y: number): V3 => [cx + Math.cos(a)*r, y, cz + Math.sin(a)*r];
  for (let i=0; i<sides; i++){ const a = ring[i], b = ring[(i+1) % sides], m = (a + (b < a ? b + Math.PI*2 : b))/2; faces.push({p:[P(a,y0), P(b,y0), P(b,y1), P(a,y1)], c:col, layer, n:[Math.cos(m), 0, Math.sin(m)], ...o}); }
  faces.push({p:ring.map(a => P(a, y1)).reverse(), c:top?.c || col, layer, n:[0,1,0], ...o, ...top});
}

// ---------- the room ----------
let room: Face[] | null = null;
/** Each doorway: its local frame (for the sliding doors) and its opening's corners (for the buttons). */
const doors: {at: (x: number, y: number, d?: number) => V3; d0: number; d1: number; open: number; q: V3[]; sign: V3[]}[] = [];
function buildRoom(){
  faces = [];
  // floor tiles, two shades, and the ceiling
  for (let x=-14; x<14; x+=2) for (let z=-12; z<8; z+=2){
    const c = ((x + z)/2 & 1) ? FLOOR : scale(FLOOR, .86);
    quad([x,0,z+2], [x+2,0,z+2], [x+2,0,z], [x,0,z], c, 0, {n:[0,1,0]});
  }
  quad([-14,WALL_H,-12], [14,WALL_H,-12], [14,WALL_H,8], [-14,WALL_H,8], CEIL, 0, {n:[0,-1,0]});
  // ceiling: a glowing hub over the holotable, beams out to the wall corners, light panels between them
  prism(HOLO[0], HOLO[2], 1.5, WALL_H-.25, WALL_H, TRIM, 1, 8, {c:[255,220,180], glow:true});
  for (let k=0; k<5; k++){ const c = corner(k, WALL_H-.2); beam([HOLO[0], WALL_H-.2, HOLO[2]], c, .35, .4, TRIM, 1); }
  for (let k=0; k<4; k++){
    const a = (ANG[k] + ANG[k+1])/2, s = Math.sin(a), c = -Math.cos(a), px = -c, pz = s, y = WALL_H-.02;
    const P = (r: number, w: number): V3 => [HOLO[0] + s*r + px*w, y, HOLO[2] + c*r + pz*w];
    quad(P(2.4,-.6), P(2.4,.6), P(5.6,.6), P(5.6,-.6), [220,210,200], 1, {glow:true});
  }
  // side walls closing the half circle back to the camera, each with a big status display and a vertical pipe
  for (const s of [-1, 1]){
    const k = s < 0 ? 0 : 4, a = corner(k,0), b: V3 = [s*R*1.02, 0, 8], u = norm(sub(b, a)), c = norm(cross(u, [0,1,0]));
    const nn = dot(c, [-s,0,0]) > 0 ? c : mul(c, -1); // facing into the room
    const at = (x: number, y: number, d = 0): V3 => { const p = add(add(a, mul(u, x)), mul(nn, d)); return [p[0], y, p[2]]; };
    quad(at(0,0), at(9,0), at(9,.9), at(0,.9), DADO, 2, {n:nn});
    quad(at(0,.9), at(9,.9), at(9,WALL_H), at(0,WALL_H), WALL, 2, {n:nn});
    // the display: a dark frame with a glowing sector map
    quad(at(1.5,1.6,.02), at(5.5,1.6,.02), at(5.5,4,.02), at(1.5,4,.02), DARK, 4, {n:nn});
    quad(at(1.7,1.8,.03), at(5.3,1.8,.03), at(5.3,3.8,.03), at(1.7,3.8,.03), [40,16,6], 4.5, {glow:true});
    for (let q=0; q<4; q++) quad(at(1.9+q*.85,2.2+((q*7)%3)*.45,.04), at(2.2+q*.85,2.2+((q*7)%3)*.45,.04), at(2.2+q*.85,2.4+((q*7)%3)*.45,.04), at(1.9+q*.85,2.4+((q*7)%3)*.45,.04), [255,138,0], 5, {glow:true, blink:q});
    beam(at(7,0,.3), at(7,WALL_H,.3), .3, .3, RUST, 5);
  }
  // the four doorway walls
  for (let k=0; k<4; k++){
    const a = corner(k,0), b = corner(k+1,0), w = Math.hypot(b[0]-a[0], b[2]-a[2]);
    const u = norm(sub(b,a)), n = norm(cross(u, [0,1,0])); // n points into the room
    const at = (x: number, y: number, d = 0): V3 => add(add(a, mul(u, x)), [n[0]*d, y, n[2]*d]);
    const wbox = (x0: number, x1: number, y0: number, y1: number, d0: number, d1: number, col: RGB, layer: number, o: Partial<Face> = {}) =>
      box8([at(x0,y0,d0), at(x1,y0,d0), at(x1,y0,d1), at(x0,y0,d1), at(x0,y1,d0), at(x1,y1,d0), at(x1,y1,d1), at(x0,y1,d1)], col, layer, o);
    const d0 = (w - DOOR_W)/2, d1 = d0 + DOOR_W, col = STATIONS[k].col, st = k;
    LIGHTS.push({p:at(w/2, 2.4, 1.4), c:col, s:.9});
    // wall around the doorway, a darker band along the floor, panel seams, sill and header around the window
    for (const [x0, x1] of [[0, d0], [d1, w]]){
      quad(at(x0,0), at(x1,0), at(x1,.9), at(x0,.9), DADO, 4, {n});
      quad(at(x0,.9), at(x1,.9), at(x1,WIN_LO), at(x0,WIN_LO), PANEL, 4, {n});
      const m = (x0 + x1)/2; quad(at(m-.03,.9,.01), at(m+.03,.9,.01), at(m+.03,WIN_LO,.01), at(m-.03,WIN_LO,.01), DARK, 4.5, {n});
    }
    quad(at(d0,DOOR_H), at(d1,DOOR_H), at(d1,WIN_LO), at(d0,WIN_LO), PANEL, 4, {n});
    wbox(0, w, WIN_LO, WIN_LO+.2, 0, .3, TRIM, 5);
    wbox(0, w, WIN_HI-.25, WIN_HI, 0, .25, TRIM, 5);
    quad(at(0,WIN_HI), at(w,WIN_HI), at(w,WALL_H), at(0,WALL_H), WALL, 4, {n});
    wbox(w/2-.08, w/2+.08, WIN_LO+.2, WIN_HI-.25, -.05, .1, TRIM, 6);
    // the corridor beyond the doorway, lit in the station's colour
    const dim = scale(col, .3);
    quad(at(d0,0,-DEEP), at(d1,0,-DEEP), at(d1,DOOR_H,-DEEP), at(d0,DOOR_H,-DEEP), dim, 2, {n, st});
    quad(at(d0+.5,.4,-DEEP+.02), at(d1-.5,.4,-DEEP+.02), at(d1-.5,DOOR_H-.4,-DEEP+.02), at(d0+.5,DOOR_H-.4,-DEEP+.02), scale(col, .55), 2.1, {glow:true, st});
    quad(at(d0,0), at(d0,0,-DEEP), at(d0,DOOR_H,-DEEP), at(d0,DOOR_H), scale(WALL, .7), 2, {n:u});
    quad(at(d1,0,-DEEP), at(d1,0), at(d1,DOOR_H), at(d1,DOOR_H,-DEEP), scale(WALL, .7), 2, {n:mul(u,-1)});
    quad(at(d0,0,-DEEP), at(d1,0,-DEEP), at(d1,0), at(d0,0), scale(FLOOR, .8), 2, {n:[0,1,0]});
    quad(at(d0,DOOR_H), at(d1,DOOR_H), at(d1,DOOR_H,-DEEP), at(d0,DOOR_H,-DEEP), scale(CEIL, .8), 2, {n:[0,-1,0]});
    quad(at(d0+.9,DOOR_H-.01,-DEEP+.3), at(d1-.9,DOOR_H-.01,-DEEP+.3), at(d1-.9,DOOR_H-.01,-.3), at(d0+.9,DOOR_H-.01,-.3), col, 2.1, {glow:true});
    // chunky door frame with blinking indicator lights, and a sign on a dark backing plate
    wbox(d0-.3, d0, 0, DOOR_H+.35, 0, .22, TRIM, 5);
    wbox(d1, d1+.3, 0, DOOR_H+.35, 0, .22, TRIM, 5);
    wbox(d0-.3, d1+.3, DOOR_H, DOOR_H+.35, 0, .22, TRIM, 5);
    quad(at(d0-.22,DOOR_H+.12,.23), at(d0-.08,DOOR_H+.12,.23), at(d0-.08,DOOR_H+.24,.23), at(d0-.22,DOOR_H+.24,.23), [255,80,60], 5.5, {glow:true, blink:k*1.3});
    quad(at(d1+.08,DOOR_H+.12,.23), at(d1+.22,DOOR_H+.12,.23), at(d1+.22,DOOR_H+.24,.23), at(d1+.08,DOOR_H+.24,.23), [90,255,120], 5.5, {glow:true, blink:k*1.3+2});
    wbox(d0+.1, d1-.1, DOOR_H+.45, DOOR_H+.95, 0, .12, DARK, 5);
    quad(at(d0+.2,DOOR_H+.52,.13), at(d1-.2,DOOR_H+.52,.13), at(d1-.2,DOOR_H+.88,.13), at(d0+.2,DOOR_H+.88,.13), scale(col, .16), 5.5, {glow:true, st});
    // hazard stripes across the threshold, and a lit strip leading into the room
    for (let q=0; q<8; q++){ const x0 = d0 + q*DOOR_W/8; quad(at(x0,.012,.55), at(x0+DOOR_W/8,.012,.55), at(x0+DOOR_W/8,.012,.05), at(x0,.012,.05), q & 1 ? DARK : HAZ, 1, {n:[0,1,0]}); }
    quad(at(w/2-.18,.01,4), at(w/2+.18,.01,4), at(w/2+.18,.01,.6), at(w/2-.18,.01,.6), scale(col, .5), 1, {glow:true, st});
    // a console beside the door: a cabinet, a sloped top and a flickering screen
    wbox(d0-1.45, d0-.55, 0, 1, 0, .6, PANEL, 5);
    box8([at(d0-1.45,1,0), at(d0-.55,1,0), at(d0-.55,1,.6), at(d0-1.45,1,.6), at(d0-1.45,1.55,0), at(d0-.55,1.55,0), at(d0-.55,1.15,.6), at(d0-1.45,1.15,.6)], TRIM, 5.2);
    const sl = norm(cross(sub(at(d0-.55,1.15,.6), at(d0-1.45,1.15,.6)), sub(at(d0-1.45,1.55,0), at(d0-1.45,1.15,.6))));
    quad(at(d0-1.35,1.19,.52), at(d0-.65,1.19,.52), at(d0-.65,1.5,.08), at(d0-1.35,1.5,.08), scale(col, .8), 5.6, {glow:true, blink:k + .5, n:sl, st});
    // a vent grille on the other side, and pipes running along the wall
    quad(at(d1+.55,1.2,.01), at(d1+1.35,1.2,.01), at(d1+1.35,2.2,.01), at(d1+.55,2.2,.01), DARK, 5, {n});
    for (let q=0; q<5; q++) quad(at(d1+.6,1.3+q*.18,.02), at(d1+1.3,1.3+q*.18,.02), at(d1+1.3,1.36+q*.18,.02), at(d1+.6,1.36+q*.18,.02), TRIM, 5.5, {n});
    wbox(0, w, 3.12, 3.34, 0, .24, RUST, 5);
    wbox(0, w, .22, .32, 0, .14, scale(TRIM, .8), 5);
    doors[k] = {at, d0, d1, open:0, q:[at(d0,0), at(d1,0), at(d1,DOOR_H), at(d0,DOOR_H)], sign:[at(d0+.25,DOOR_H+.86,.14), at(d1-.25,DOOR_H+.86,.14), at(d0+.25,DOOR_H+.54,.14)]};
  }
  // window mullions: thick struts at the panel corners
  for (let k=0; k<5; k++){
    const c = corner(k,0), n = norm([-c[0], 0, ZC - c[2]]), t: V3 = [n[2], 0, -n[0]];
    const p0 = add(c, mul(t,-.3)), p1 = add(c, mul(t,.3)), p2 = add(p1, mul(n,.45)), p3 = add(p0, mul(n,.45));
    box8([p0, p1, p2, p3, [p0[0],WALL_H,p0[2]], [p1[0],WALL_H,p1[2]], [p2[0],WALL_H,p2[2]], [p3[0],WALL_H,p3[2]]], TRIM, 6);
  }
  // props for each station: cantina table and stools, R&D server racks, an engineering workbench with a spare engine, hangar crates
  const pos = (k: number, side: number, r: number): [number, number] => { const a = (ANG[k] + ANG[k+1])/2 + side*.22; return [Math.sin(a)*r, ZC - Math.cos(a)*r]; };
  { const [x, z] = pos(0, -1, 5.2); prism(x, z, .55, 0, 1.05, TRIM, 7, 8, {c:[60,90,64]}); prism(x, z, .12, 0, 1, DARK, 7, 6);
    for (const [dx, dz] of [[.9,.3],[-.2,.95]]) prism(x+dx, z+dz, .25, 0, .7, RUST, 7, 6, {c:[120,60,50]});
    const [bx, bz] = pos(0, 1, 6.6); box(bx-.6, 0, bz-.25, bx+.6, 1.15, bz+.25, [70,56,48], 7);
    quad([bx-.55,1.6,bz-.26], [bx+.55,1.6,bz-.26], [bx+.55,1.95,bz-.26], [bx-.55,1.95,bz-.26], [255,90,160], 7.5, {glow:true, blink:3.3}); }
  for (const side of [-1, 1]){ const [x, z] = pos(1, side*1.2, 6.1); box(x-.4, 0, z-.4, x+.4, 2.4, z+.4, DARK, 7);
    for (let q=0; q<5; q++) box(x-.3, .35+q*.42, z+.39, x+.3, .43+q*.42, z+.42, STATIONS[1].col, 7.2, {glow:true, blink:q*1.7 + side}); }
  { const [x, z] = pos(2, 1.2, 6); box(x-.9, 0, z-.4, x+.9, .95, z+.4, TRIM, 7); box(x-.85, .95, z-.35, x+.85, 1.0, z+.35, [50,70,84], 7.1);
    const [ex, ez] = pos(2, -1.25, 5.8); box(ex-.45, 0, ez-.45, ex+.45, .9, ez+.45, [80,84,96], 7); box(ex-.3, .2, ez+.45, ex+.3, .7, ez+.5, [255,140,60], 7.2, {glow:true, blink:5}); }
  { const [x, z] = pos(3, 1.3, 6); box(x-.6, 0, z-.6, x+.6, 1.1, z+.6, [120,96,60], 7); box(x-.45, 1.1, z-.45, x+.45, 1.9, z+.45, [96,104,112], 7);
    const [cx, cz] = pos(3, .8, 4.9); box(cx-.5, 0, cz-.5, cx+.5, .9, cz+.5, [128,104,64], 7);
    box(x-.62, .5, z-.62, x+.62, .62, z+.62, HAZ, 7.1, {}); }
  // the raised dais with a glowing rim, and the holotable on it
  prism(HOLO[0], HOLO[2], 2.8, 0, .2, [46,50,60], 7, 12, {c:[44,48,58]});
  prism(HOLO[0], HOLO[2], 2.82, .2, .24, [60,170,210], 7.05, 12, {c:[44,48,58]}, {glow:true});
  prism(HOLO[0], HOLO[2], 1.1, .24, .95, PANEL, 8, 8, {c:[40,110,150], glow:true});
  for (const f of faces) if (!f.glow) f.lit = light(f);
  room = faces;
}

// ---------- outside the window ----------
// The rest of the station: trusses, solar arrays, a habitat drum, a docked freighter. Drawn before the room, so only the window shows it.
let outside: Face[] | null = null;
function buildOutside(){
  faces = [];
  const MET: RGB = [74,80,94];
  beam([-70, 9, -60], [60, 13, -75], 1.4, 1.4, MET, 0);
  for (let x=-60; x<=50; x+=10){ const t = (x + 70)/130, y = 9 + 4*t, z = -60 - 15*t; beam([x, y-6, z], [x, y+6, z], .5, .5, MET, 0); }
  for (const x of [-48, -28, 28, 48]){ const t = (x + 70)/130, y = 9 + 4*t, z = -60 - 15*t;
    for (const s of [-1, 1]){ const y0 = y + s*7, y1 = y + s*16;
      quad([x-4, y0, z], [x+4, y0, z], [x+4, y1, z], [x-4, y1, z], [30,60,120], 0, {n:[0,0,1]});
      for (let q=1; q<4; q++){ const yy = y0 + (y1-y0)*q/4; quad([x-4, yy-.12, z+.05], [x+4, yy-.12, z+.05], [x+4, yy+.12, z+.05], [x-4, yy+.12, z+.05], [70,100,160], 0, {n:[0,0,1]}); } } }
  prism(24, -46, 6, -4, 22, [86,92,104], 0, 10, {c:[96,104,116]});
  for (let q=0; q<6; q++) quad([18.5, 2+q*3, -40.6], [20, 2+q*3, -40.2], [20, 2.6+q*3, -40.2], [18.5, 2.6+q*3, -40.6], [255,220,140], 0.5, {glow:true, blink:q});
  box(-34, 4, -36, -14, 8, -30, [92,96,108], 0);
  box(-38, 5, -35, -34, 7, -31, [70,74,84], 0);
  for (let q=0; q<7; q++) quad([-32+q*2.6, 6.4, -29.99], [-31+q*2.6, 6.4, -29.99], [-31+q*2.6, 6.9, -29.99], [-32+q*2.6, 6.9, -29.99], [255,220,150], 0.5, {glow:true});
  beam([-14, 6, -33], [-6, 6, -22], .8, .8, MET, 0);
  for (const f of faces) if (!f.glow) f.lit = light(f);
  outside = faces;
}

const cam = {x:0, y:1.75, z:6.2, yaw:0, pitch:.06};
let hover = -1;
const FOG: RGB = [0,0,0];
// The whole room is graded to three inks by brightness, with the contrast pushed hard: black, red, then yellow at the top.
const RAMP: [number, RGB][] = [[0,[0,0,0]], [.3,[16,3,3]], [.48,[150,14,10]], [.66,[255,48,20]], [.82,[255,196,0]], [1,[255,246,170]]];
function grade(c: RGB): RGB {
  const L = Math.min(1, Math.max(0, ((c[0]*.3 + c[1]*.55 + c[2]*.15)/255 - .02)*2.2));
  for (let i=1; i<RAMP.length; i++) if (L <= RAMP[i][0]){ const [a, ca] = RAMP[i-1], [b, cb] = RAMP[i], t = (L - a)/(b - a); return [0,1,2].map(n => ca[n] + (cb[n] - ca[n])*t) as RGB; }
  return RAMP[RAMP.length-1][1];
}
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
function shade(f: Face, depth: number, far: boolean): string {
  let c = f.glow ? f.c : f.lit || light(f);
  if (f.blink != null) c = scale(c, .55 + .45*Math.max(0, Math.sin(G.time*(2.2 + f.blink%1.7) + f.blink*2.1)));
  if (f.st != null && f.st === hover){ const k = .3 + .2*Math.sin(G.time*6); c = c.map(v => Math.min(255, v*(1 + k) + 24*k)) as RGB; }
  const fog = far ? clamp(depth/160, .15, .55) : clamp((depth - 6)/26, 0, .7);
  return `rgb(${grade(c.map((v, i) => v*(1-fog) + FOG[i]*fog) as RGB).map(Math.round).join(',')})`;
}
function drawFaces(fs: Face[], far = false){
  const list: {s: [number, number][]; d: number; f: Face}[] = [], eye: V3 = [cam.x, cam.y, cam.z];
  for (const f of fs){
    if (f.n && dot(f.n, sub(eye, f.p[0])) <= 0) continue;
    const cs = clipNear(f.p.map(toCam)); if (cs.length < 3) continue;
    list.push({s:cs.map(toScreen), d:cs.reduce((a, c) => a + c[2], 0)/cs.length, f});
  }
  list.sort((a, b) => a.f.layer - b.f.layer || b.d - a.d);
  for (const {s, d, f} of list){
    ctx.fillStyle = shade(f, d, far); ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
    for (let i=1; i<s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
    // inked edges on everything but the floor and ceiling tiles
    if (f.layer > 1 && !far){ ctx.closePath(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.closePath(); ctx.fill();
  }
}
// The sliding doors: each pair parts as its station is hovered, showing the lit corridor behind.
function doorFaces(dt: number): Face[] {
  faces = [];
  doors.forEach((D, k) => {
    D.open += ((hover === k ? 1 : 0) - D.open)*Math.min(1, dt*6);
    const hw = DOOR_W/2, sh = D.open*hw*.92, at = D.at, n = norm(sub(at(0,0,1), at(0,0)));
    for (const [x0, dir] of [[D.d0, -1], [D.d0 + hw, 1]] as const){
      const a = x0 + dir*sh, b = a + hw, edge = dir < 0 ? b - .08 : a;
      quad(at(a,0,-.06), at(b,0,-.06), at(b,DOOR_H,-.06), at(a,DOOR_H,-.06), DOOR, 3, {n});
      quad(at(a+.15,1.2,-.05), at(b-.15,1.2,-.05), at(b-.15,1.35,-.05), at(a+.15,1.35,-.05), scale(DOOR, .7), 3.1, {n});
      quad(at(edge,.2,-.05), at(edge+.08,.2,-.05), at(edge+.08,DOOR_H-.2,-.05), at(edge,DOOR_H-.2,-.05), STATIONS[k].col, 3.2, {glow:true, st:k});
    }
  });
  return faces;
}
// A shuttle crossing the window now and then, engines glowing.
function shuttle(): Face[] {
  faces = [];
  const t = (G.time % 26)/26, x = -90 + 180*t, y = 16, z = -95;
  box(x-3, y-.8, z-1, x+3, y+.8, z+1, [110,116,130], 0);
  box(x-4.2, y-.5, z-.7, x-3, y+.5, z+.7, [255,170,80], 0, {glow:true});
  for (const f of faces) if (!f.glow) f.lit = light(f);
  return faces;
}
// The starting ship as little cubes spinning over the holotable; only faces that no neighbour hides are drawn.
export function holoShip(): Face[] {
  const d: [number, number, Cell][] = startDesign().d.map(([k, t]) => [KI(k), KJ(k), t]);
  let m = 1; for (const [i, j] of d) m = Math.max(m, Math.abs(i), Math.abs(j));
  const s = Math.min(.22, 1.5/(2*m + 1)), yaw = G.time*.5, c = Math.cos(yaw), sn = Math.sin(yaw), cx = HOLO[0], cz = HOLO[2], base = 1.6 + .05*Math.sin(G.time*2);
  const filled = new Set(d.map(([i, j]) => i+','+j)), out: Face[] = [];
  // spin around the vertical, then tip the far side up so the deck faces the viewer
  const ct = Math.cos(.75), st = Math.sin(.75);
  const P = (x: number, y: number, z: number): V3 => { const xr = x*c - z*sn, zr = x*sn + z*c; return [cx + xr, base + y*ct - zr*st, cz + zr*ct + y*st]; };
  for (const [i, j, t] of d){
    const col = hex((COL.p[(HEAD_OF[t as BlockType] || t) as Cell] || COL.p[t] || '#bcd0f5')), x0 = i*s - s/2, x1 = x0 + s, z0 = j*s - s/2, z1 = z0 + s, y0 = -s/2, y1 = s/2;
    out.push({p:[P(x0,y1,z0), P(x1,y1,z0), P(x1,y1,z1), P(x0,y1,z1)], c:col, layer:9});
    if (!filled.has(i+','+(j-1))) out.push({p:[P(x0,y0,z0), P(x1,y0,z0), P(x1,y1,z0), P(x0,y1,z0)], c:col, layer:9});
    if (!filled.has(i+','+(j+1))) out.push({p:[P(x1,y0,z1), P(x0,y0,z1), P(x0,y1,z1), P(x1,y1,z1)], c:col, layer:9});
    if (!filled.has((i-1)+','+j)) out.push({p:[P(x0,y0,z1), P(x0,y0,z0), P(x0,y1,z0), P(x0,y1,z1)], c:col, layer:9});
    if (!filled.has((i+1)+','+j)) out.push({p:[P(x1,y0,z0), P(x1,y0,z1), P(x1,y1,z1), P(x1,y1,z0)], c:col, layer:9});
  }
  // a projector ring turning under the ship
  const rr = 1.0, y = base - .45, a0 = -G.time*.8;
  for (let q=0; q<12; q += 2){
    const a = a0 + q/12*Math.PI*2, b = a + Math.PI*2/12, p = (ang: number, r: number): V3 => [cx + Math.cos(ang)*r, y, cz + Math.sin(ang)*r];
    out.push({p:[p(a, rr), p(b, rr), p(b, rr-.06), p(a, rr-.06)], c:[95,216,255], layer:8.5, glow:true});
  }
  return out;
}
export function renderBase(dt: number){
  if (!room) buildRoom();
  if (!outside) buildOutside();
  FL = Math.min(W*.5, H*.95);
  // the camera holds still apart from a barely-there sway: the station buttons ride on the doorways,
  // so a camera that turned toward the hovered door would slide the button out from under the pointer
  cam.yaw = Math.sin(G.time*.3)*.003;
  // space through the window: stars, a ringed planet, then the station's exterior
  drawSpace(G.time*4, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H); // space through the window stays near black
  const pc = toCam([-30, 26, -140]);
  if (pc[2] > 1){
    const [px, py] = toScreen(pc), pr = 18/pc[2]*FL;
    ctx.fillStyle = '#300606'; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#8a1208'; ctx.beginPath(); ctx.arc(px - pr*.25, py - pr*.25, pr*.8, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,0,.7)'; ctx.lineWidth = Math.max(1, pr*.06);
    ctx.beginPath(); ctx.ellipse(px, py, pr*1.8, pr*.45, -.25, 0, Math.PI*2); ctx.stroke();
  }
  drawFaces([...outside!, ...shuttle()], true);
  drawFaces([...room!, ...doorFaces(dt), ...holoShip()]);
  // the holotable's beam of light
  const [bx, by] = toScreen(toCam([HOLO[0], .95, HOLO[2]])), [tx, ty] = toScreen(toCam([HOLO[0], 2.2, HOLO[2]])), bw = 1.2/toCam([HOLO[0], 1.5, HOLO[2]])[2]*FL;
  const g = ctx.createLinearGradient(0, by, 0, ty); g.addColorStop(0, 'rgba(255,196,0,.3)'); g.addColorStop(1, 'rgba(255,196,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - bw*.55, by); ctx.lineTo(bx + bw*.55, by); ctx.lineTo(tx + bw, ty); ctx.lineTo(tx - bw, ty); ctx.closePath(); ctx.fill();
  signs();
  placeButtons();
}
// The station names, lit on the signs over the doorways. The text is laid onto each sign's plane so it sits in the room,
// and drawn on the full-resolution layer so even the far signs stay legible.
function signs(){
  const X = hctx, k0 = PX*DPR;
  X.textBaseline = 'middle'; X.textAlign = 'center';
  doors.forEach((D, k) => {
    const cs = D.sign.map(toCam); if (cs.some(c => c[2] < .2)) return;
    const [tl, tr, bl] = cs.map(toScreen), S = STATIONS[k];
    X.setTransform(1,0,0,1,0,0); X.font = '30px Anton, Impact, sans-serif'; const tw = Math.max(X.measureText(S.sign).width + 16, 90), th = 34;
    // map the text box onto the sign: left to right along its top edge, top to bottom down its side
    X.setTransform((tr[0]-tl[0])/tw*k0, (tr[1]-tl[1])/tw*k0, (bl[0]-tl[0])/th*k0, (bl[1]-tl[1])/th*k0, tl[0]*k0, tl[1]*k0);
    const lit = hover === k ? 1 : .6 + .4*(.5 + .5*Math.sin(G.time*2 + k));
    X.globalAlpha = .4*lit; X.fillStyle = `rgb(${S.col.join(',')})`; X.fillText(S.sign, tw/2 + 1.5, th/2 + 1.5);
    X.globalAlpha = lit; X.fillStyle = hover === k ? '#ffffff' : `rgb(${S.col.map(v => Math.min(255, v + 50)).join(',')})`; X.fillText(S.sign, tw/2, th/2);
  });
  X.setTransform(1,0,0,1,0,0); X.globalAlpha = 1;
}
// keep each station's button over its doorway
function placeButtons(){
  doors.forEach((D, k) => {
    const b = $('st-'+STATIONS[k].id), cs = D.q.map(toCam);
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
    b.setAttribute('aria-label', s.name); b.title = s.name;
    b.addEventListener('pointerenter', () => { hover = k; });
    b.addEventListener('pointerleave', () => { if (hover === k) hover = -1; });
    b.addEventListener('focus', () => { hover = k; });
    b.addEventListener('blur', () => { if (hover === k) hover = -1; });
    b.addEventListener('click', () => act(s.id));
    root.append(b);
  }
}
