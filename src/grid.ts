// ---------- grid keys ----------
import type { Facing, Key } from './types';

export const BS = 10; // world units per block; 1 block reads as 10 m (M_PER_BLOCK)
export const K = (i: number, j: number): Key => (i+512)*1024 + (j+512);
export const KI = (k: Key) => Math.floor(k/1024) - 512, KJ = (k: Key) => k%1024 - 512;
export const CORE = K(0,0), NB = [1024,-1024,1,-1];
export const rand = (a: number, b: number) => a + Math.random()*(b-a);
export const clamp = (v: number, a: number, b: number) => v<a ? a : v>b ? b : v;
// railguns and lasers swing up to 5° off their facing toward the aim point
export const SWING = 5*Math.PI/180;
export const angDiff = (a: number, b: number) => { let d = (a-b) % (2*Math.PI); if (d > Math.PI) d -= 2*Math.PI; if (d < -Math.PI) d += 2*Math.PI; return d; };
export const TAU = Math.PI*2;
// facing o: 0..7 in 45° steps clockwise from fore (0 fore, 2 starboard, 4 aft, 6 port; odd values are diagonals).
// FA is the ship-local angle, DIR its unit vector, FACE the neighbouring cell it points at. Railguns and lasers use even facings only.
export const FA = Array.from({length:8}, (_,o) => -Math.PI/2 + o*Math.PI/4);
export const DIR = FA.map(a => [Math.cos(a), Math.sin(a)] as const);
export const FACE = DIR.map(([x,y]) => [Math.round(x), Math.round(y)] as const);
export const ARROW = ['↑','↗','→','↘','↓','↙','←','↖'], FACING = ['fore','fore-stbd','starboard','aft-stbd','aft','aft-port','port','fore-port'];
export const mirrorO = (o: Facing) => (8-o) % 8, flipO = (o: Facing) => (12-o) % 8;
// mirror modes: 0 off, 1 left/right, 2 fore/aft, 3 four-way
export const MIRROR = ['Off','⇆ L/R','⇅ F/A','✣ 4-way'];
