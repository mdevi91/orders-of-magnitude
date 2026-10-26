import { HM, LV, PARTS, T, def } from './catalog';
import { cellsFor } from './editor';
import { DIR, FACE, K } from './grid';
import { speedOf } from './state';
import type { Cell, Engine, Facing, Key, Physics } from './types';

/** What occupies a cell, if anything. */
export type TypeAt = (k: Key) => Cell | undefined;
interface CellInfo { t: Cell; i: number; j: number; o?: Facing }

// ---------- ship physics ----------
// cells: iterable of {t,i,j,o}; typeAt(k) answers what occupies a cell. Engines only count when their exhaust cell is open.
// own: the player's ship, whose blocks carry its upgrade levels and hangar research; enemies fly on bare block stats
export function physics(cells: Iterable<CellInfo>, typeAt: TypeAt, own = true): Physics {
  const lv = (t: Cell) => own ? LV(t) : 1, drive = own ? HM.drive() : 1;
  let mass=0, inertia=0, torque=0, coreT=0, jetCW=0, jetCCW=0;
  const F = {px:0, nx:0, py:0, ny:0}, engines: Engine[] = [];
  for (const c of cells){
    const d = def(c.t); if (!d) continue;
    const m = d.mass || 0;
    mass += m; inertia += m*(c.i*c.i + c.j*c.j + .17); torque += (d.torque||0)*lv(c.t)*drive;
    if (c.t==='engine'){
      const [fx,fy] = FACE[c.o||0], [ux,uy] = DIR[c.o||0], active = !typeAt(K(c.i-fx, c.j-fy));
      const thrust = T.engine.thrust!*lv('engine')*drive, tx = ux*thrust, ty = uy*thrust, tau = c.i*ty - c.j*tx;
      engines.push({c: c as Engine['c'], active, tx, ty, tau});
      if (active){
        if (tx > 0) F.px += tx; else F.nx -= tx;
        if (ty > 0) F.py += ty; else F.ny -= ty;
        if (tau > 0) jetCW += tau*.6; else jetCCW -= tau*.6;
      }
    } else coreT += d.thrust||0;
  }
  return {mass, inertia, torque, coreT, F, jetCW, jetCCW, engines};
}
export const dirSpeed = (ph: Physics, lx: number, ly: number) => speedOf(ph.coreT + ph.F.px*Math.max(0,lx) + ph.F.nx*Math.max(0,-lx) + ph.F.py*Math.max(0,ly) + ph.F.ny*Math.max(0,-ly), ph.mass);
export function partComplete(typeAt: TypeAt, i: number, j: number, t: Cell, o: Facing){
  const P = PARTS[t]!;
  return cellsFor(i,j,t,o).every(([a,b], n) => !n || typeAt(K(a,b)) === P.body);
}
export function laneFwd(typeAt: TypeAt, i: number, j: number, o: Facing){
  const [fx,fy] = FACE[o];
  for (let n=1; n<=40; n++) if (typeAt(K(i+fx*n, j+fy*n))) return false;
  return true;
}
