import { Vector3 } from 'three';
import { LV, PARTS, T, def } from './catalog';
import { cellsFor } from './editor';
import { DIRV, FACE, K } from './grid';
import { speedOf } from './state';
import type { Cell, Engine, Facing, Key, Physics } from './types';

/** What occupies a cell, if anything. */
export type TypeAt = (k: Key) => Cell | undefined;
interface CellInfo { t: Cell; i: number; j: number; l: number; o?: Facing }

// ---------- ship physics ----------
// cells: iterable of {t,i,j,l,o}; typeAt(k) answers what occupies a cell. Engines only count when their exhaust cell is open.
export function physics(cells: Iterable<CellInfo>, typeAt: TypeAt): Physics {
  let mass=0, inertia=0, torque=0, coreT=0;
  const F = {px:0, nx:0, py:0, ny:0, pz:0, nz:0}, engines: Engine[] = [];
  for (const c of cells){
    const d = def(c.t); if (!d) continue;
    const m = d.mass || 0;
    mass += m; inertia += m*(c.i*c.i + c.j*c.j + c.l*c.l + .17); torque += (d.torque||0)*LV(c.t);
    if (c.t==='engine'){
      // an engine pushes toward its facing; its exhaust needs the cell behind it open
      const o = c.o||0, [fi,fj,fl] = FACE[o], active = !typeAt(K(c.i-fi, c.j-fj, c.l-fl));
      const thrust = T.engine.thrust!*LV('engine'), dir = DIRV[o];
      engines.push({c: c as Engine['c'], active, dir, thrust});
      if (active){
        if (dir.x > 0) F.px += thrust; else if (dir.x < 0) F.nx += thrust;
        if (dir.y > 0) F.py += thrust; else if (dir.y < 0) F.ny += thrust;
        if (dir.z > 0) F.pz += thrust; else if (dir.z < 0) F.nz += thrust;
      }
    } else coreT += d.thrust||0;
  }
  return {mass, inertia, torque, coreT, F, engines};
}
/** Top speed along a ship-local unit direction. */
export const dirSpeed = (ph: Physics, d: Vector3) => speedOf(ph.coreT
  + ph.F.px*Math.max(0,d.x) + ph.F.nx*Math.max(0,-d.x) + ph.F.py*Math.max(0,d.y) + ph.F.ny*Math.max(0,-d.y)
  + ph.F.pz*Math.max(0,d.z) + ph.F.nz*Math.max(0,-d.z), ph.mass);
export function partComplete(typeAt: TypeAt, i: number, j: number, l: number, t: Cell, o: Facing){
  const P = PARTS[t]!;
  return cellsFor(i,j,l,t,o).every(([a,b,c], n) => !n || typeAt(K(a,b,c)) === P.body);
}
/** Nothing of our own straight ahead of a beam weapon. */
export function laneFwd(typeAt: TypeAt, i: number, j: number, l: number, o: Facing){
  const [fi,fj,fl] = FACE[o];
  for (let n=1; n<=40; n++) if (typeAt(K(i+fi*n, j+fj*n, l+fl*n))) return false;
  return true;
}
