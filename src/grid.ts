// ---------- grid keys ----------
// Ships are voxel grids. A cell is (i, j, l): i to starboard, j aft, l up. In world space a ship's local frame maps
// i → +x, l → +y, j → +z, so the nose points along local -z (the same "forward" as a three.js camera).
import { Vector3 } from 'three';
import type { Facing, Key } from './types';

export const BS = 10; // world units per block; 1 block = 1 m
const M1 = 1024, M2 = 1024*1024;
export const K = (i: number, j: number, l = 0): Key => (i+512)*M2 + (j+512)*M1 + (l+512);
export const KI = (k: Key) => Math.floor(k/M2) - 512, KJ = (k: Key) => Math.floor(k/M1)%M1 - 512, KL = (k: Key) => k%M1 - 512;
export const CORE = K(0,0,0);
/** the six face neighbours of a cell, as key offsets */
export const NB = [M2, -M2, M1, -M1, 1, -1];
export const rand = (a: number, b: number) => a + Math.random()*(b-a);
export const clamp = (v: number, a: number, b: number) => v<a ? a : v>b ? b : v;
// railguns and lasers swing up to 5° off their facing toward the aim point
export const SWING = 5*Math.PI/180;
export const angDiff = (a: number, b: number) => { let d = (a-b) % (2*Math.PI); if (d > Math.PI) d -= 2*Math.PI; if (d < -Math.PI) d += 2*Math.PI; return d; };
export const TAU = Math.PI*2;

// Facing o: 0 fore, 1 starboard, 2 aft, 3 port, 4 up, 5 down.
// FACE is the neighbouring cell it points at as [di, dj, dl]; DIRV the same direction as a ship-local vector.
export const FACE: readonly (readonly [number, number, number])[] = [[0,-1,0],[1,0,0],[0,1,0],[-1,0,0],[0,0,1],[0,0,-1]];
export const DIRV = FACE.map(([di,dj,dl]) => new Vector3(di, dl, dj));
/** A wide part's second column runs to the "starboard" of its facing: clockwise from above, or to starboard for up/down. */
export const SIDE: readonly Facing[] = [1, 2, 3, 0, 1, 1];
export const OPP: readonly Facing[] = [2, 3, 0, 1, 5, 4];
export const ARROW = ['↑','→','↓','←','⤒','⤓'], FACING = ['fore','starboard','aft','port','up','down'];
// mirror twins: left/right swaps starboard and port, fore/aft swaps fore and aft
export const mirrorO = (o: Facing) => o===1 ? 3 : o===3 ? 1 : o, flipO = (o: Facing) => o===0 ? 2 : o===2 ? 0 : o;
// mirror modes: 0 off, 1 left/right, 2 fore/aft, 3 four-way
export const MIRROR = ['Off','⇆ L/R','⇅ F/A','✣ 4-way'];
/** Ship-local position of a cell, in world units. */
export const cellVec = (i: number, j: number, l: number, out = new Vector3()) => out.set(i*BS, l*BS, j*BS);
