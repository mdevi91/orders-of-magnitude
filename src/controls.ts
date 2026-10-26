import { audio, muted, setMute, sfx } from './audio';
import { layoutBuild } from './draw';
import { rotate } from './editor';
import { pauseMenu, togglePause } from './fights';
import { undo, undoStack, zoomAt } from './input';
import { repair } from './loot';
import { openOptions, showOptions } from './options';
import { leaveEngineering, runOver } from './runs';
import { NODE, mapAction, nodeDef, toDrydock, toMap } from './starmap';
import { G } from './state';
import { syncUI, toast } from './ui';
import { $ } from './view';

// Abandon run asks twice in the game itself (no browser pop-up): the first click arms the button for 3 s, the second ends the run.
let abandonArmed = -1e9;
export const abandon = (e?: Event) => {
  const b = (e?.currentTarget || document.activeElement) as HTMLElement | null;
  if (performance.now() - abandonArmed < 3000){ abandonArmed = -1e9; G.paused = false; runOver('abandoned'); return; }
  abandonArmed = performance.now();
  if (b && b.tagName === 'BUTTON'){ const was = b.textContent; b.textContent = 'Click again to abandon'; setTimeout(() => { if (b.textContent === 'Click again to abandon') b.textContent = was; }, 3000); }
};
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
  // ⚙: in a fight it pauses and opens Options behind the pause menu
  $('optBtn').addEventListener('click', () => { if (G.mode==='combat'){ if (!G.paused) togglePause(); showOptions(pauseMenu); } else openOptions(); });
  $('mirror').addEventListener('click', cycleMirror);
  $('rot').addEventListener('click', rotate);
  // in Engineering the button saves the starting ship and goes back to the base
  $('launch').addEventListener('click', () => { if (G.outfit) leaveEngineering(); else toMap(); });
}
