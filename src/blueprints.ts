import { sfx } from './audio';
import { HEAD_OF, PLATE, T } from './catalog';
import { cellsFor, removeCell } from './editor';
import { CORE, K, KI, KJ, KL, NB } from './grid';
import { snap, undoStack } from './input';
import { G } from './state';
import { syncUI, toast } from './ui';
import type { BlockType, Facing, Key } from './types';
import { $ } from './view';

// Blueprints: three saved designs in this browser. Loading strips the ship back to its core, then rebuilds the blueprint
// from cargo and credits, leaving out whatever you don't have (and anything that would no longer connect to the core).
// 3D designs use different cell keys from the flat ones, so they live under a new name
export const BP = 'oom-bp-3d';
/** A saved design: its cells and their facings, as stored in localStorage. */
interface Blueprint { d: [Key, BlockType][]; o: [Key, Facing][] }
export const bpGet = (): (Blueprint | null)[] => { try { const v = JSON.parse(localStorage.getItem(BP) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
export const bpPut = (v: (Blueprint | null)[]) => { try { localStorage.setItem(BP, JSON.stringify(v)); } catch {} };
export function renderBps(){
  const v = bpGet(), el = $('bps'); let h = '';
  for (let n=0; n<3; n++){
    const b = v[n];
    h += `<div class="bp"><span>Slot ${n+1} · ${b ? b.d.length+' blocks' : 'empty'}</span><button class="rot" type="button" data-save="${n}">Save</button><button class="rot" type="button" data-load="${n}"${b ? '' : ' disabled'}>Load</button></div>`;
  }
  if (el.innerHTML !== h) el.innerHTML = h;
}
export function bpSave(n: number){
  const v = bpGet(); v[n] = {d:[...G.design], o:[...G.dirs]}; bpPut(v); toast(`Saved to slot ${n+1}`); renderBps();
}
export function bpLoad(n: number){
  const b = bpGet()[n]; if (!b) return;
  if (G.broken.size){ toast('Repair or remove damaged blocks first'); return; }
  undoStack.push(snap());
  for (const k of [...G.design.keys()]) if (k!==CORE) removeCell(k);
  const want = new Map(b.d.filter(([,t]) => T[t])), dirs = new Map(b.o), missing: Partial<Record<BlockType, number>> = {};
  // nearest cells first, so whatever runs out is the outer edge of the design
  const heads = [...want].filter(([k,t]) => k!==CORE && !HEAD_OF[t]).sort(([a],[c]) => Math.hypot(KI(a),KJ(a),KL(a)) - Math.hypot(KI(c),KJ(c),KL(c)));
  for (const [k,t] of heads){
    const o = dirs.get(k) || 0, cells = cellsFor(KI(k), KJ(k), KL(k), t, T[t].rot ? o : 0);
    if (cells.some(([a,b,c]) => G.design.has(K(a,b,c)))) continue;
    if (PLATE(t) ? T[t].cost > G.credits : !((G.inv[t] || 0) > 0)){ missing[t] = (missing[t]||0) + 1; continue; }
    if (PLATE(t)) G.credits -= T[t].cost; else G.inv[t] = (G.inv[t] || 0) - 1;
    for (const [a,b,c,ct] of cells){ G.design.set(K(a,b,c), ct); if (T[ct].rot) G.dirs.set(K(a,b,c), o); }
  }
  // drop anything left floating, back into cargo
  const seen = new Set([CORE]), q = [CORE];
  while (q.length){ const c = q.pop()!; for (const nb of NB){ const m = c+nb; if (G.design.has(m) && !seen.has(m)){ seen.add(m); q.push(m); } } }
  for (const k of [...G.design.keys()]) if (!seen.has(k)) removeCell(k);
  const miss = Object.keys(missing) as BlockType[];
  sfx('upgrade'); toast(miss.length ? `Loaded slot ${n+1}, short of ${miss.map(t => `${missing[t]} ${T[t].name.toLowerCase()}`).join(', ')}` : `Loaded slot ${n+1}`); syncUI();
}

// wiring that runs once at start-up
export function init(){
  $('bps').addEventListener('click', e => {
    const s = (e.target as Element).closest('button'); if (!s) return;
    if (s.dataset.save) bpSave(+s.dataset.save); else if (s.dataset.load) bpLoad(+s.dataset.load);
  });
}
