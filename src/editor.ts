import { sfx } from './audio';
import { HEAD_OF, PARTS, PLATE, T, def, isPart, repCost } from './catalog';
import { CORE, FACE, K, NB, SIDE, flipO, mirrorO } from './grid';
import { assignAt } from './groups';
import { dmgOf, takeCargo } from './loot';
import { G, blockCount, blockLimit, buildR } from './state';
import type { BlockType, Cell, Facing, Key } from './types';
import { syncUI, toast } from './ui';

/** A cell with a facing. */
type Spot = [number, number, number, Facing];

// ---------- building ----------
// Mirror modes: 0 off, 1 left/right, 2 fore/aft, 3 four-way. Returns every cell (with facing) a placement at (i,j,l,o) also covers.
export function mirrorSpots(i: number, j: number, l: number, o: Facing): Spot[] {
  const m = G.mir, out: Spot[] = [[i,j,l,o]];
  if (m===1 || m===3) out.push([-i,j,l,mirrorO(o)]);
  if (m===2 || m===3) out.push([i,-j,l,flipO(o)]);
  if (m===3) out.push([-i,-j,l,flipO(mirrorO(o))]);
  const seen = new Set<string>(); return out.filter(([a,b,c]) => { const k = a+','+b+','+c; if (seen.has(k)) return false; seen.add(k); return true; });
}
// Cells a placement covers: the clicked cell plus, for multi-cell parts, body cells trailing behind the facing (and to its side if wide).
export function cellsFor<C extends Cell>(i: number, j: number, l: number, t: C, o: Facing){
  const out: [number, number, number, C | BlockType][] = [[i,j,l,t]], P = PARTS[t];
  if (P){
    const [fi,fj,fl] = FACE[o], [si,sj,sl] = FACE[SIDE[o]];
    for (let m=0; m<(P.w||1); m++) for (let n=0; n<P.len; n++) if (n || m) out.push([i-fi*n+si*m, j-fj*n+sj*m, l-fl*n+sl*m, P.body]);
  }
  return out;
}
// Mirror twins of a placement. A wide part extends to one side of its head, so its twin's head is found by mirroring the whole footprint.
export function placeSpots(i: number, j: number, l: number, o: Facing, t: BlockType): Spot[] {
  const spots = mirrorSpots(i,j,l,o), P = PARTS[t];
  if (!(P && P.w && P.w > 1)) return spots;
  const own = cellsFor(i,j,l,t,o);
  return spots.map(([a,b,c,mo]) => {
    const si = a===i ? 1 : -1, sj = b===j ? 1 : -1, cells = own.map(([x,y,z]) => [si*x, sj*y, z]), set = new Set(cells.map(([x,y,z]) => K(x,y,z)));
    const h = cells.find(([x,y,z]) => cellsFor(x,y,z,t,mo).every(([u,v,w]) => set.has(K(u,v,w))));
    return h ? [h[0], h[1], h[2], mo] : [a,b,c,mo];
  });
}
/** true if the block can go there, otherwise the reason it can't. */
export function placeCheck(i: number, j: number, l: number, t: BlockType, o: Facing): true | string {
  const R = buildR(), oo = T[t].rot ? o : 0, cells = cellsFor(i,j,l,t,oo);
  for (const [a,b,c] of cells) if (Math.max(Math.abs(a),Math.abs(b),Math.abs(c)) > R) return 'Too far from the ship';
  const k = K(i,j,l), cur = G.design.get(k);
  if (cur==='core') return 'The core stays where it is';
  if (cur && isPart(cur)) return `Sell that ${T[cur].name.toLowerCase()} first`;
  if (PARTS[t]) for (const [a,b,c] of cells) if (G.design.has(K(a,b,c))) return `${T[t].name} needs ${cells.length} empty cells`;
  if (cur===t && (!T[t].rot || (G.dirs.get(k)||0)===oo)) return 'Already placed';
  if (!cur && blockCount() >= blockLimit()) return `Block limit reached (${blockLimit()}): it grows each sector`;
  if (PLATE(t)){
    const back = cur && PLATE(cur) && !G.broken.has(k) ? T[cur].cost : 0;
    if (T[t].cost - back > G.credits) return `Not enough credits for ${T[t].name.toLowerCase()}`;
  } else if (!((G.inv[t] || 0) > 0)) return `No ${T[t].name.toLowerCase()} left in cargo`;
  if (!cur){
    const own = new Set(cells.map(([a,b,c]) => K(a,b,c)));
    if (!cells.some(([a,b,c]) => NB.some(d => { const n = K(a,b,c)+d; return !own.has(n) && G.design.has(n); }))) return 'Blocks must touch your ship';
  }
  return true;
}
export function tryPlace(i: number, j: number, l: number, t: BlockType, o: Facing): true | string {
  const why = placeCheck(i,j,l,t,o); if (why !== true) return why;
  const k = K(i,j,l), oo = T[t].rot ? o : 0;
  if (G.design.has(k)) removeCell(k);
  const hurt = PLATE(t) ? (G.credits -= T[t].cost, false) : takeCargo(t);
  for (const [a,b,c,ct] of cellsFor(i,j,l,t,oo)){
    const kk = K(a,b,c); G.design.set(kk,ct);
    if (T[ct].rot) G.dirs.set(kk,oo); else G.dirs.delete(kk);
  }
  if (hurt) G.broken.add(k);
  return true;
}
// A body cell belongs to the head that sits ahead of it (and to the other side, for wide parts) along the shared facing.
export function headOf(i: number, j: number, l: number): [number, number, number] {
  const k = K(i,j,l), t = G.design.get(k), ht = t && HEAD_OF[t];
  if (!ht) return [i,j,l];
  const o = G.dirs.get(k)||0, [fi,fj,fl] = FACE[o], [si,sj,sl] = FACE[SIDE[o]], P = PARTS[ht]!;
  for (let m=0; m<(P.w||1); m++) for (let n=0; n<P.len; n++){
    const a = i+fi*n-si*m, b = j+fj*n-sj*m, c = l+fl*n-sl*m, hk = K(a,b,c);
    if (G.design.get(hk)===ht && (G.dirs.get(hk)||0)===o) return [a,b,c];
  }
  return [i,j,l];
}
// A damaged block goes back to cargo still damaged (damaged plating refunds its value less the repair).
export function removeCell(k: Key){
  const t = G.design.get(k); if (!t) return;
  const was = G.broken.delete(k); G.design.delete(k); G.dirs.delete(k); delete G.grp[k];
  if (HEAD_OF[t]) return;
  if (PLATE(t)) G.credits += was ? Math.max(0, T[t].cost - repCost(t)) : T[t].cost;
  else { G.inv[t] = (G.inv[t]||0) + 1; if (was) G.dmg[t] = dmgOf(t) + 1; }
}
export function sellAt(i: number, j: number, l: number){
  const cur = G.design.get(K(i,j,l));
  if (!cur || cur==='core') return;
  const [hi_, hj, hl] = headOf(i,j,l), hk = K(hi_,hj,hl), ht = G.design.get(hk)!;
  if (PARTS[ht]){
    const cells = cellsFor(hi_,hj,hl,ht,G.dirs.get(hk)||0);
    // a part with any damaged cell goes back to cargo damaged
    if (cells.some(([a,b,c]) => G.broken.has(K(a,b,c)))) G.broken.add(hk);
    for (const [a,b,c] of cells) if (G.design.has(K(a,b,c))) removeCell(K(a,b,c));
  }
  else removeCell(K(i,j,l));
  // anything no longer joined to the core goes back to cargo too
  const seen = new Set([CORE]), q = [CORE];
  while (q.length){ const c = q.pop()!; for (const d of NB){ const n = c+d; if (G.design.has(n) && !seen.has(n)){ seen.add(n); q.push(n); } } }
  for (const kk of [...G.design.keys()]) if (!seen.has(kk)) removeCell(kk);
}
// Tapping a placed turret or engine of the selected type turns it to the next facing (and its mirror twin).
export function spinAt(i: number, j: number, l: number){
  const k = K(i,j,l), t = G.design.get(k);
  if (!t || t!==G.sel || !def(t)!.rot || PARTS[t]) return false;
  const o = ((G.dirs.get(k)||0) + 1) % 6; G.dirs.set(k,o); G.rot = o;
  for (const [a,b,c,mo] of mirrorSpots(i,j,l,o).slice(1)) if (G.design.get(K(a,b,c))===t) G.dirs.set(K(a,b,c), mo);
  return true;
}
/** Place onto the empty cell beside a face, or remove the block under the cursor. */
export function buildAction(mode: 'place' | 'sell', tap = false){
  const h = G.hover; if (!h) return;
  if (G.grpBrush){ assignAt(h.i,h.j,h.l); syncUI(); return; }
  sfx('place');
  if (mode!=='sell' && tap && spinAt(h.i,h.j,h.l)){ G.drag = null; syncUI(); return; }
  if (mode==='sell'){ for (const [a,b,c] of mirrorSpots(h.i,h.j,h.l,0)) sellAt(a,b,c); }
  else {
    const [first, ...rest] = placeSpots(h.ni,h.nj,h.nl,G.rot,G.sel), r = tryPlace(first[0],first[1],first[2],G.sel,first[3]);
    for (const [a,b,c,mo] of rest) tryPlace(a,b,c,G.sel,mo);
    if (r !== true && r !== 'Already placed') toast(r);
  }
  syncUI();
}
export function rotate(){ G.rot = (G.rot+1) % 6; syncUI(); }
