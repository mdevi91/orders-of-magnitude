import { audio, muted, setMute } from './audio';
import { abandon } from './controls';
import { row } from './shop';
import { G } from './state';
import { setTutOff, tutOff } from './tutorial';
import { hideOverlay, showOverlay, toast, type OverlayAction } from './ui';
import { $ } from './view';

// ---------- options ----------
// Settings kept in this browser. Esc or the ⚙ button opens them; in a fight they sit behind the pause menu.
const read = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const store = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch {} };
const OPTS: {id: string; name: string; sub: string; val: () => string; flip: () => void}[] = [
  {id:'shift', name:'Shift steering', sub:'While Shift is held the nose follows the mouse. WASD then moves along the ship (W forward, A/D slide sideways) or straight up, left, down and right on screen.',
    val:() => G.shiftAbs ? 'Screen' : 'Ship', flip:() => { G.shiftAbs = !G.shiftAbs; store('oom-shiftabs', G.shiftAbs); }},
  {id:'sound', name:'Sound', sub:'All sound effects.', val:() => muted ? 'Off' : 'On', flip:() => { audio(); setMute(!muted); }},
  {id:'shake', name:'Screen shake', sub:'The camera kick from hits and explosions.', val:() => G.calm ? 'Off' : 'On', flip:() => { G.calm = !G.calm; store('oom-calm', G.calm); }},
  {id:'tips', name:'Tutorial tips', sub:'Hints the first time you meet each part of the game.', val:() => tutOff ? 'Off' : 'On', flip:() => setTutOff(!tutOff)},
];
let back: () => void = hideOverlay;
export const optionsOpen = () => !$('overlay').hidden && $('ovTitle').textContent === 'Options';
/** Opens Options; Back (or Esc) returns to `from`. */
export function showOptions(from: () => void = back){
  back = from;
  showOverlay('Options', '<div class="rows">' + OPTS.map(o => row(o.name, o.sub, o.val(), `opt:${o.id}`)).join('') + '</div>',
    [['Back', () => back()], ...(G.stats ? [['Abandon run', abandon, 'ghost reset'] as OverlayAction] : [])], false, {eye:'Options · saved in this browser'});
}
export const closeOptions = () => back();
export function flipOption(id: string){ OPTS.find(o => o.id===id)?.flip(); showOptions(); }
/** The ⚙ button and Esc outside a fight: only over the game itself, not over another window. */
export function openOptions(){
  if (optionsOpen()) return closeOptions();
  if (!$('overlay').hidden){ toast('Close this window first'); return; }
  showOptions(hideOverlay);
}

// wiring that runs once at start-up
export function init(){
  G.shiftAbs = read('oom-shiftabs'); G.calm = read('oom-calm');
}
