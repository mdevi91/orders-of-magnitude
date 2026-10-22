import { audio, muted, setMute, sfx } from './audio';
import { rotate } from './editor';
import { togglePause } from './fights';
import { clamp } from './grid';
import { undo, undoStack } from './input';
import { repair } from './loot';
import { runOver } from './runs';
import { NODE, mapAction, nodeDef, toDrydock, toMap } from './starmap';
import { G } from './state';
import { syncUI, toast } from './ui';
import { $ } from './view';

export const abandon = () => { if (confirm('Abandon this run? You keep the data it has earned so far.')) runOver('abandoned'); };
/** Drydock zoom: f > 1 moves the camera in. */
export const zoomBtn = (f: number) => { G.bDist = clamp((G.bDist || 1)/f, .3, 4); };
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
  $('zFit').addEventListener('click', () => { G.bDist = 1; G.bYaw = .7; G.bPitch = .5; });
  $('pauseBtn').addEventListener('click', togglePause);
  $('muteBtn').addEventListener('click', () => { audio(); setMute(!muted); });
  setMute(muted);
  $('mirror').addEventListener('click', cycleMirror);
  $('rot').addEventListener('click', rotate);
  $('launch').addEventListener('click', toMap);
}
