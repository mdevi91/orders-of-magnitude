import { audio, muted, setMute, sfx } from './audio';
import { layoutBuild } from './draw';
import { rotate } from './editor';
import { togglePause } from './fights';
import { undo, undoStack, zoomAt } from './input';
import { repair } from './loot';
import { runOver } from './runs';
import { save } from './save';
import { NODE, mapAction, nodeDef, toDrydock, toMap } from './starmap';
import { G } from './state';
import { syncUI, toast } from './ui';
import { $ } from './view';

export const abandon = () => { if (confirm('Abandon this run? You keep the data it has earned so far.')) runOver('abandoned'); };
export const zoomBtn = (f: number) => { const L = layoutBuild(); zoomAt(L.cx, L.cy, f); };
export function cycleMirror(){ G.mir = (G.mir + 1) % 4; syncUI(); }

// wiring that runs once at start-up
export function init(){
  $('reset').addEventListener('click', abandon);
  $('mapAbandon').addEventListener('click', abandon);
  $('repair').addEventListener('click', () => {
    const n = repair(1); if (!n){ toast('Not enough credits'); return; }
    // credits spent on repairs can't come back through undo
    undoStack.length = 0; sfx('upgrade'); toast(G.broken.size ? `Repaired ${n}, ${G.broken.size} still damaged` : 'Ship repaired'); syncUI();
  });
  $('mapGo').addEventListener('click', mapAction);
  $('toDock').addEventListener('click', toDrydock);
  $('legend').innerHTML = (Object.keys(NODE) as (keyof typeof NODE)[]).filter(t => t!=='start' && t!=='ambush').map(t => { const N = nodeDef(t); return `<li><b style="color:${N.col}">${N.g}</b>${N.name}</li>`; }).join('');
  $('zIn').addEventListener('click', () => zoomBtn(1.4));
  $('zOut').addEventListener('click', () => zoomBtn(1/1.4));
  $('undo').addEventListener('click', undo);
  $('zFit').addEventListener('click', () => { G.bz = 1; G.bpx = G.bpy = 0; });
  $('pauseBtn').addEventListener('click', togglePause);
  $('muteBtn').addEventListener('click', () => { audio(); setMute(!muted); });
  setMute(muted);
  $('mirror').addEventListener('click', cycleMirror);
  $('rot').addEventListener('click', rotate);
  // the first launch ends outfitting
  $('launch').addEventListener('click', () => { if (G.outfit){ G.outfit = false; save(); } toMap(); });
}
