// @ts-nocheck
import { LV, PARTS, T } from './catalog';
import { cellsFor } from './editor';
import { DIR, FACE, K } from './grid';
import { speedOf } from './state';

// ---------- ship physics ----------
// cells: iterable of {t,i,j,o}; typeAt(k) answers what occupies a cell. Engines only count when their exhaust cell is open.
export function physics(cells, typeAt){
  let mass=0, inertia=0, torque=0, coreT=0, jetCW=0, jetCCW=0;
  const F = {px:0, nx:0, py:0, ny:0}, engines = [];
  for (const c of cells){
    const d = T[c.t]; mass += d.mass; inertia += d.mass*(c.i*c.i + c.j*c.j + .17); torque += (d.torque||0)*LV(c.t);
    if (c.t==='engine'){
      const [fx,fy] = FACE[c.o||0], [ux,uy] = DIR[c.o||0], active = !typeAt(K(c.i-fx, c.j-fy));
      const tx = ux*d.thrust*LV('engine'), ty = uy*d.thrust*LV('engine'), tau = c.i*ty - c.j*tx;
      engines.push({c, active, tx, ty, tau});
      if (active){
        if (tx > 0) F.px += tx; else F.nx -= tx;
        if (ty > 0) F.py += ty; else F.ny -= ty;
        if (tau > 0) jetCW += tau*.6; else jetCCW -= tau*.6;
      }
    } else coreT += d.thrust||0;
  }
  return {mass, inertia, torque, coreT, F, jetCW, jetCCW, engines};
}
export const dirSpeed = (ph,lx,ly) => speedOf(ph.coreT + ph.F.px*Math.max(0,lx) + ph.F.nx*Math.max(0,-lx) + ph.F.py*Math.max(0,ly) + ph.F.ny*Math.max(0,-ly), ph.mass);
export function partComplete(typeAt, i, j, t, o){
  const P = PARTS[t];
  return cellsFor(i,j,t,o).every(([a,b], n) => !n || typeAt(K(a,b)) === P.body);
}
export function laneFwd(typeAt, i, j, o){
  const [fx,fy] = FACE[o];
  for (let n=1; n<=40; n++) if (typeAt(K(i+fx*n, j+fy*n))) return false;
  return true;
}
