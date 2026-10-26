import { sfx } from './audio';
import { HEAD_OF, PARTS, PLATE, T, WEDGE, canBuyHere, def, faceFor, isPart, outfitPrice, partOffsets, repCost } from './catalog';
import { layoutBuild } from './draw';
import { CORE, FACE, K, NB, flipO, mirrorO } from './grid';
import { assignAt } from './groups';
import { dmgOf, takeCargo } from './loot';
import { G, buildR } from './state';
import type { BlockType, Cell, Facing, Key } from './types';
import { syncUI, toast } from './ui';

/** A cell with what goes in it, or a cell with a facing. */
type Spot = [number, number, Facing];

// ---------- building ----------
// Mirror modes: 0 off, 1 left/right, 2 fore/aft, 3 four-way. Returns every cell (with facing) a placement at (i,j,o) also covers.
export function mirrorSpots(i: number, j: number, o: Facing): Spot[] {
  const m = G.mir, out: Spot[] = [[i,j,o]];
  if (m===1 || m===3) out.push([-i,j,mirrorO(o)]);
  if (m===2 || m===3) out.push([i,-j,flipO(o)]);
  if (m===3) out.push([-i,-j,flipO(mirrorO(o))]);
  const seen = new Set<string>(); return out.filter(([a,b]) => { const k = a+','+b; if (seen.has(k)) return false; seen.add(k); return true; });
}
// Cells a placement covers: the clicked cell plus, for multi-cell parts, body cells trailing behind the facing (and to starboard if wide, or in the part's own shape).
export function cellsFor<C extends Cell>(i: number, j: number, t: C, o: Facing){
  const out: [number, number, C | BlockType][] = [[i,j,t]], P = PARTS[t];
  if (P){
    const [fx,fy] = FACE[o], [sx,sy] = FACE[(o+2)%8];
    for (const [n,m] of partOffsets(P)) if (n || m) out.push([i-fx*n+sx*m, j-fy*n+sy*m, P.body]);
  }
  return out;
}
// Mirror twins of a placement. A wide part extends to one side of its head, so its twin's head is found by mirroring the whole footprint.
export function placeSpots(i: number, j: number, o: Facing, t: BlockType): Spot[] {
  const spots = mirrorSpots(i,j,o), P = PARTS[t];
  if (!(P && P.w && P.w > 1)) return spots;
  const own = cellsFor(i,j,t,o);
  return spots.map(([a,b,mo]) => {
    const si = a===i ? 1 : -1, sj = b===j ? 1 : -1, cells = own.map(([x,y]) => [si*x, sj*y]), set = new Set(cells.map(([x,y]) => K(x,y)));
    const h = cells.find(([x,y]) => cellsFor(x,y,t,mo).every(([u,v]) => set.has(K(u,v))));
    return h ? [h[0], h[1], mo] : [a,b,mo];
  });
}
/** true if the block can go there, otherwise the reason it can't. */
export function placeCheck(i: number, j: number, t: BlockType, o: Facing): true | string {
  const R = buildR(), oo = faceFor(t, o), cells = cellsFor(i,j,t,oo);
  for (const [a,b] of cells) if (Math.max(Math.abs(a),Math.abs(b)) > R) return 'Outside the build grid';
  const k = K(i,j), cur = G.design.get(k);
  if (cur==='core' || cur==='cockpit') return 'The cockpit stays where it is';
  if (cur && isPart(cur)) return `Sell that ${T[cur].name.toLowerCase()} first`;
  if (PARTS[t]) for (const [a,b] of cells) if (G.design.has(K(a,b))) return `${T[t].name} needs ${cells.length} empty cells`;
  if (cur===t && (!T[t].rot || (G.dirs.get(k)||0)===oo)) return 'Already placed';
  if (PLATE(t)){
    const back = cur && PLATE(cur) && !G.broken.has(k) ? T[cur].cost : 0;
    if (T[t].cost - back > G.credits) return `Not enough credits for ${T[t].name.toLowerCase()}`;
  } else if (!((G.inv[t] || 0) > 0)){
    if (!canBuyHere(t)) return `No ${T[t].name.toLowerCase()} left in cargo`;
    if (outfitPrice(t) > G.credits) return `Not enough credits for ${T[t].name.toLowerCase()}`;
  }
  if (!cur){
    const own = new Set(cells.map(([a,b]) => K(a,b)));
    if (!cells.some(([a,b]) => NB.some(d => { const n = K(a,b)+d; return !own.has(n) && G.design.has(n); }))) return 'Blocks must touch your ship';
  }
  return true;
}
export function tryPlace(i: number, j: number, t: BlockType, o: Facing): true | string {
  const why = placeCheck(i,j,t,o); if (why !== true) return why;
  const k = K(i,j), oo = faceFor(t, o);
  if (G.design.has(k)) removeCell(k);
  if (!PLATE(t) && !((G.inv[t] || 0) > 0)){ G.credits -= outfitPrice(t); G.inv[t] = 1; } // outfitting: bought on the spot
  const hurt = PLATE(t) ? (G.credits -= T[t].cost, false) : takeCargo(t);
  for (const [a,b,ct] of cellsFor(i,j,t,oo)){
    const kk = K(a,b); G.design.set(kk,ct);
    if (T[ct].rot) G.dirs.set(kk,oo); else G.dirs.delete(kk);
  }
  if (hurt) G.broken.add(k);
  return true;
}
// A body cell belongs to the head that sits ahead of it (and to port, for wide parts) along the shared facing.
export function headOf(i: number, j: number): [number, number] {
  const k = K(i,j), t = G.design.get(k), ht = t && HEAD_OF[t];
  if (!ht) return [i,j];
  const o = G.dirs.get(k)||0, [fx,fy] = FACE[o], [sx,sy] = FACE[(o+2)%8], P = PARTS[ht]!;
  for (const [n,m] of partOffsets(P)){
    const a = i+fx*n-sx*m, b = j+fy*n-sy*m, hk = K(a,b);
    if (G.design.get(hk)===ht && (G.dirs.get(hk)||0)===o) return [a,b];
  }
  return [i,j];
}
// A damaged block goes back to cargo still damaged (damaged plating refunds its value less the repair).
export function removeCell(k: Key){
  const t = G.design.get(k); if (!t) return;
  const was = G.broken.delete(k); G.design.delete(k); G.dirs.delete(k); delete G.grp[k];
  if (HEAD_OF[t]) return;
  if (PLATE(t)) G.credits += was ? Math.max(0, T[t].cost - repCost(t)) : T[t].cost;
  else if (G.outfit) G.credits += outfitPrice(t); // Engineering: blocks are bought on the spot, so taking one off refunds it
  else { G.inv[t] = (G.inv[t]||0) + 1; if (was) G.dmg[t] = dmgOf(t) + 1; }
}
export function sellAt(i: number, j: number){
  const cur = G.design.get(K(i,j));
  if (!cur || cur==='core' || cur==='cockpit') return;
  const [hi_, hj] = headOf(i,j), ht = G.design.get(K(hi_,hj))!;
  if (PARTS[ht]){
    const cells = cellsFor(hi_,hj,ht,G.dirs.get(K(hi_,hj))||0);
    // a part with any damaged cell is scrapped whole
    if (cells.some(([a,b]) => G.broken.has(K(a,b)))) G.broken.add(K(hi_,hj));
    for (const [a,b] of cells) if (G.design.has(K(a,b))) removeCell(K(a,b));
  }
  else removeCell(K(i,j));
  const seen = new Set([CORE]), q = [CORE];
  while (q.length){ const c = q.pop()!; for (const d of NB){ const n = c+d; if (G.design.has(n) && !seen.has(n)){ seen.add(n); q.push(n); } } }
  for (const kk of [...G.design.keys()]) if (!seen.has(kk)) removeCell(kk);
}
// Tapping a placed turret or engine of the selected type turns it 45° (and its mirror twin).
export function spinAt(i: number, j: number){
  const k = K(i,j), t = G.design.get(k);
  if (!t || t!==G.sel || !def(t)!.rot || PARTS[t]) return false;
  const o = faceFor(t, (((G.dirs.get(k)||0) + (WEDGE(t) ? 2 : 1)) % 8) as Facing); G.dirs.set(k,o); G.rot = o;
  for (const [a,b,mo] of mirrorSpots(i,j,o).slice(1)) if (G.design.get(K(a,b))===t) G.dirs.set(K(a,b), mo);
  return true;
}
export function buildAction(i: number, j: number, mode: 'place' | 'sell', tap = false){
  if (G.grpBrush){ assignAt(i,j); syncUI(); return; }
  sfx('place');
  if (mode!=='sell' && tap && spinAt(i,j)){ G.drag = null; syncUI(); return; }
  if (mode==='sell'){ for (const [a,b] of mirrorSpots(i,j,0)) sellAt(a,b); }
  else {
    const [first, ...rest] = placeSpots(i,j,G.rot,G.sel), r = tryPlace(first[0],first[1],G.sel,first[2]);
    for (const [a,b,mo] of rest) tryPlace(a,b,G.sel,mo);
    if (r !== true && r !== 'Already placed') toast(r);
  }
  syncUI();
}
export function cellAt(x: number, y: number){ const {cx,cy,cs} = layoutBuild(); return {i:Math.round((x-cx)/cs), j:Math.round((y-cy)/cs)}; }
export function rotate(){ G.rot = PARTS[G.sel] ? ((G.rot & ~1) + 2) % 8 : WEDGE(G.sel) ? ((G.rot | 1) + 2) % 8 : (G.rot+1) % 8; syncUI(); }
