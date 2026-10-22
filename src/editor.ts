// @ts-nocheck
import { sfx } from './audio';
import { HEAD_OF, PARTS, PLATE, T, isPart, repCost } from './catalog';
import { layoutBuild } from './draw';
import { CORE, FACE, K, NB, mirrorSpots } from './grid';
import { assignAt } from './groups';
import { dmgOf, takeCargo } from './loot';
import { G, blockCount, blockLimit, buildR } from './state';
import { syncUI, toast } from './ui';

// ---------- building ----------
// Cells a placement covers: the clicked cell plus, for multi-cell parts, body cells trailing behind the facing (and to starboard if wide).
export function cellsFor(i,j,t,o){
  const out = [[i,j,t]], P = PARTS[t];
  if (P){
    const [fx,fy] = FACE[o], [sx,sy] = FACE[(o+2)%8];
    for (let m=0; m<(P.w||1); m++) for (let n=0; n<P.len; n++) if (n || m) out.push([i-fx*n+sx*m, j-fy*n+sy*m, P.body]);
  }
  return out;
}
// Mirror twins of a placement. A wide part extends to one side of its head, so its twin's head is found by mirroring the whole footprint.
export function placeSpots(i,j,o,t){
  const spots = mirrorSpots(i,j,o);
  if (!(PARTS[t] && PARTS[t].w > 1)) return spots;
  const own = cellsFor(i,j,t,o);
  return spots.map(([a,b,mo]) => {
    const si = a===i ? 1 : -1, sj = b===j ? 1 : -1, cells = own.map(([x,y]) => [si*x, sj*y]), set = new Set(cells.map(([x,y]) => K(x,y)));
    const h = cells.find(([x,y]) => cellsFor(x,y,t,mo).every(([u,v]) => set.has(K(u,v))));
    return h ? [h[0], h[1], mo] : [a,b,mo];
  });
}
export function placeCheck(i,j,t,o){
  const R = buildR(), oo = T[t].rot ? o : 0, cells = cellsFor(i,j,t,oo);
  for (const [a,b] of cells) if (Math.max(Math.abs(a),Math.abs(b)) > R) return 'Outside the build grid';
  const k = K(i,j), cur = G.design.get(k);
  if (cur==='core') return 'The core stays where it is';
  if (isPart(cur)) return `Sell that ${T[cur].name.toLowerCase()} first`;
  if (PARTS[t]) for (const [a,b] of cells) if (G.design.has(K(a,b))) return `${T[t].name} needs ${cells.length} empty cells`;
  if (cur===t && (!T[t].rot || (G.dirs.get(k)||0)===oo)) return 'Already placed';
  if (!cur && blockCount() >= blockLimit()) return `Block limit reached (${blockLimit()}): it grows each sector`;
  if (PLATE(t)){
    const back = cur && PLATE(cur) && !G.broken.has(k) ? T[cur].cost : 0;
    if (T[t].cost - back > G.credits) return `Not enough credits for ${T[t].name.toLowerCase()}`;
  } else if (!(G.inv[t] > 0)) return `No ${T[t].name.toLowerCase()} left in cargo`;
  if (!cur){
    const own = new Set(cells.map(([a,b]) => K(a,b)));
    if (!cells.some(([a,b]) => NB.some(d => { const n = K(a,b)+d; return !own.has(n) && G.design.has(n); }))) return 'Blocks must touch your ship';
  }
  return true;
}
export function tryPlace(i,j,t,o){
  const why = placeCheck(i,j,t,o); if (why !== true) return why;
  const k = K(i,j), oo = T[t].rot ? o : 0;
  if (G.design.has(k)) removeCell(k);
  const hurt = PLATE(t) ? (G.credits -= T[t].cost, false) : takeCargo(t);
  for (const [a,b,ct] of cellsFor(i,j,t,oo)){
    const kk = K(a,b); G.design.set(kk,ct);
    if (T[ct].rot) G.dirs.set(kk,oo); else G.dirs.delete(kk);
  }
  if (hurt) G.broken.add(k);
  return true;
}
// A body cell belongs to the head that sits ahead of it (and to port, for wide parts) along the shared facing.
export function headOf(i,j){
  const k = K(i,j), t = G.design.get(k);
  if (!HEAD_OF[t]) return [i,j];
  const o = G.dirs.get(k)||0, [fx,fy] = FACE[o], [sx,sy] = FACE[(o+2)%8], ht = HEAD_OF[t], P = PARTS[ht];
  for (let m=0; m<(P.w||1); m++) for (let n=0; n<P.len; n++){
    const a = i+fx*n-sx*m, b = j+fy*n-sy*m, hk = K(a,b);
    if (G.design.get(hk)===ht && (G.dirs.get(hk)||0)===o) return [a,b];
  }
  return [i,j];
}
// A removed block goes back to cargo (plating is refunded); a damaged one is scrapped.
// A damaged block goes back to cargo still damaged (damaged plating refunds its value less the repair).
export function removeCell(k){
  const t = G.design.get(k), was = G.broken.delete(k); G.design.delete(k); G.dirs.delete(k); delete G.grp[k];
  if (HEAD_OF[t]) return;
  if (PLATE(t)) G.credits += was ? Math.max(0, T[t].cost - repCost(t)) : T[t].cost;
  else { G.inv[t] = (G.inv[t]||0) + 1; if (was) G.dmg[t] = dmgOf(t) + 1; }
}
export function sellAt(i,j){
  const cur = G.design.get(K(i,j));
  if (!cur || cur==='core') return;
  const [hi_, hj] = headOf(i,j), ht = G.design.get(K(hi_,hj));
  if (PARTS[ht]){
    const cells = cellsFor(hi_,hj,ht,G.dirs.get(K(hi_,hj))||0);
    // a part with any damaged cell is scrapped whole
    if (cells.some(([a,b]) => G.broken.has(K(a,b)))) G.broken.add(K(hi_,hj));
    for (const [a,b] of cells) if (G.design.has(K(a,b))) removeCell(K(a,b));
  }
  else removeCell(K(i,j));
  const seen = new Set([CORE]), q = [CORE];
  while (q.length){ const c = q.pop(); for (const d of NB){ const n = c+d; if (G.design.has(n) && !seen.has(n)){ seen.add(n); q.push(n); } } }
  for (const kk of [...G.design.keys()]) if (!seen.has(kk)) removeCell(kk);
}
// Tapping a placed turret or engine of the selected type turns it 45° (and its mirror twin).
export function spinAt(i,j){
  const k = K(i,j), t = G.design.get(k);
  if (!t || t!==G.sel || !T[t].rot || PARTS[t]) return false;
  const o = ((G.dirs.get(k)||0) + 1) % 8; G.dirs.set(k,o); G.rot = o;
  for (const [a,b,mo] of mirrorSpots(i,j,o).slice(1)) if (G.design.get(K(a,b))===t) G.dirs.set(K(a,b), mo);
  return true;
}
export function buildAction(i,j,mode,tap){
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
export function cellAt(x,y){ const {cx,cy,cs} = layoutBuild(); return {i:Math.round((x-cx)/cs), j:Math.round((y-cy)/cs)}; }
export function rotate(){ G.rot = PARTS[G.sel] ? ((G.rot & ~1) + 2) % 8 : (G.rot+1) % 8; syncUI(); }
