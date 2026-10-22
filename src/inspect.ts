// Design checks for the drydock: which turrets can see out of the hull, and how far a design reaches.
import { Vector3 } from 'three';
import { def } from './catalog';
import { DIRV, K, KI, KJ, KL } from './grid';
import { G } from './state';
import type { Cell, Facing, Key } from './types';

export const designType = (k: Key) => G.design.get(k);
// turrets that need a clear line out of the hull (missiles and mines launch over it)
export const aimsOut = (t: Cell) => { const g = def(t)?.gun; return !!g && !g.homing && !g.lob && t!=='core'; };
export const designR = () => { let R = 0; for (const k of G.design.keys()) R = Math.max(R, Math.hypot(KI(k), KJ(k), KL(k))); return R; };
// Cells a ray from (i,j,l) along a ship-local direction travels before meeting another design block, or Infinity if it gets out.
export function rayOut(i: number, j: number, l: number, d: Vector3, R: number){
  for (let s=.7; s<R+1.75; s+=.45){
    const ci = Math.round(i + d.x*s), cj = Math.round(j + d.z*s), cl = Math.round(l + d.y*s);
    if ((ci!==i || cj!==j || cl!==l) && G.design.has(K(ci,cj,cl))) return s;
  }
  return Infinity;
}
/** Sample directions over a turret's cone: its facing and rings around it. */
export function arcRays(o: Facing, t: Cell){
  const arc = def(t)?.gun?.arc || 0, f = DIRV[o], out = [f.clone()];
  const u = Math.abs(f.y) > .9 ? new Vector3(1,0,0) : new Vector3(0,1,0), a = new Vector3().crossVectors(f, u).normalize(), b = new Vector3().crossVectors(f, a);
  for (const ring of [.5, 1]) for (let q=0; q<8; q++){
    const th = arc*ring*.98, ph = q/8*Math.PI*2;
    out.push(f.clone().multiplyScalar(Math.cos(th)).addScaledVector(a, Math.sin(th)*Math.cos(ph)).addScaledVector(b, Math.sin(th)*Math.sin(ph)).normalize());
  }
  return out;
}
// Share of a design turret's firing cone that has a clear line out of the hull (the same ray walk as laneClear).
export function arcClear(i: number, j: number, l: number, o: Facing, t: Cell){
  const R = designR(), rays = arcRays(o, t);
  return rays.filter(d => rayOut(i, j, l, d, R) === Infinity).length/rays.length;
}
