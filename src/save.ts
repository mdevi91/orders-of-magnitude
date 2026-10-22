// @ts-nocheck
import { sfx } from './audio';
import { bpGet, bpPut } from './blueprints';
import { undoStack } from './input';
import { curNode, toMap } from './starmap';
import { G } from './state';
import { toast } from './ui';
import { $ } from './view';

// The run lives in this browser's localStorage, apart from the hangar's data and upgrades, which outlive every run.
// Every read and write is guarded so a blocked store just means no saving.
export const RUN = 'oom-run-v1', METAK = 'oom-meta-v1';
export function save(){
  if (!G.stats) return;
  try { localStorage.setItem(RUN, JSON.stringify(saveData())); } catch {}
}
export function load(d){
  try {
    d = d || JSON.parse(localStorage.getItem(RUN) || 'null');
    if (!d || d.v !== 3 || !Array.isArray(d.design) || !d.map || !d.stats) return false;
    G.stage = d.stage; G.credits = d.credits; G.design = new Map(d.design); G.dirs = new Map(d.dirs); G.lv = d.lv || {};
    G.mir = d.mir ?? 1; G.spanT = d.spanT || 0; G.span0 = d.span0 || 0; G.spanStage = d.spanStage;
    G.inv = d.inv || {}; G.dmg = d.dmg || {}; G.grp = d.grp || {}; G.auto = d.auto || [false,false,false,true,false]; G.broken = new Set(d.broken || []); G.map = d.map; G.stats = d.stats; G.node = curNode();
    return true;
  } catch { return false; }
}
export const saveData = () => ({v:3, stage:G.stage, credits:G.credits, design:[...G.design], dirs:[...G.dirs], lv:G.lv, mir:G.mir, spanT:G.spanT, span0:G.span0, spanStage:G.spanStage,
  inv:G.inv, dmg:G.dmg, grp:G.grp, auto:G.auto, broken:[...G.broken], map:G.map, stats:G.stats});
export function clearRun(){ G.stats = null; try { localStorage.removeItem(RUN); } catch {} }
export function saveMeta(){ try { localStorage.setItem(METAK, JSON.stringify(G.meta)); } catch {} }
export function loadMeta(){ try { const m = JSON.parse(localStorage.getItem(METAK) || 'null'); if (m && typeof m.data==='number') G.meta = {data:m.data, lv:m.lv || {}}; } catch {} }

// wiring that runs once at start-up
export function init(){
  $('saveNow').addEventListener('click', () => {
    try { localStorage.setItem(RUN, JSON.stringify(saveData())); saveMeta(); toast('Game saved'); } catch { toast('This browser blocks saving: use Export'); }
  });
  // a save file carries the run, the hangar and the blueprints
  $('saveExp').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({game:'orders-of-magnitude', save:saveData(), meta:G.meta, bp:bpGet()})], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orders-of-magnitude-sector${G.stage}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Save file exported');
  });
  $('saveImp').addEventListener('click', () => $('saveFile').click());
  $('saveFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let d; try { d = JSON.parse(await f.text()); } catch {}
    if (!d || d.game !== 'orders-of-magnitude' || !d.save){ toast('Not an Orders of Magnitude save file'); return; }
    if (d.save.v !== 3){ toast('That save is from before the roguelite update'); return; }
    if (!confirm(`Load the sector ${d.save.stage} save? It replaces your current run.`)) return;
    if (!load(d.save)){ toast('That save file is damaged'); return; }
    if (d.meta && typeof d.meta.data==='number'){ G.meta = {data:d.meta.data, lv:d.meta.lv || {}}; saveMeta(); }
    if (Array.isArray(d.bp)) bpPut(d.bp);
    undoStack.length = 0; sfx('upgrade'); toast(`Loaded sector ${G.stage} save`); toMap();
  });
}
