import { audio, muted, setMute } from './audio';
import { PAL, PLATE, unlocked } from './catalog';
import { abandon } from './controls';
import { LAST_SECTOR } from './fights';
import { newRun } from './runs';
import { save, saveMeta } from './save';
import { row } from './shop';
import { curNode, genMap, toMap } from './starmap';
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
  {id:'shake', name:'Screen shake', sub:'The camera kick and the flash frames from hits and kills.', val:() => G.calm ? 'Off' : 'On', flip:() => { G.calm = !G.calm; store('oom-calm', G.calm); }},
  {id:'tips', name:'Tutorial tips', sub:'Hints the first time you meet each part of the game.', val:() => tutOff ? 'Off' : 'On', flip:() => setTutOff(!tutOff)},
];
// Test mode, for trying late-game content: open the game with ?test in the address. Players never see it.
const TEST = new URLSearchParams(location.search).has('test');
const TESTS: Record<string, () => void> = {
  unlock: () => { G.meta.best = LAST_SECTOR; saveMeta(); toast('Every block and cockpit unlocked'); },
  data: () => { G.meta.data += 1000; saveMeta(); toast('+1000 data'); },
  credits: () => { G.credits += 1000; save(); toast('+1000 credits'); },
  cargo: () => { for (const t of PAL) if (t!=='sell' && !PLATE(t) && unlocked(t)) G.inv[t] = (G.inv[t] || 0) + 5; save(); toast('5 of every unlocked block in cargo'); },
};
/** A fresh run that starts in sector s, with some credits to match. */
function startAt(s: number){
  G.paused = false; newRun();
  G.stage = s; G.map = genMap(s); G.node = curNode(); G.credits += 150*(s - 1);
  save(); toMap(); toast(`Run started in sector ${s}`);
}
function testRows(){
  if (!TEST) return '';
  return '<div class="rows"><h3>Test mode</h3>' + row('Unlock everything', `Best sector ${LAST_SECTOR}: every block and cockpit.`, 'Do', 'opt:t-unlock') + row('Data', 'For Research &amp; Development.', '+1000', 'opt:t-data') +
    (G.stats ? row('Credits', '', '+1000', 'opt:t-credits') + row('Fill cargo', '5 of every unlocked block.', 'Do', 'opt:t-cargo') : '') +
    (G.mode!=='combat' ? '<div class="row"><span>Start a run in sector</span><span class="tsec">' + Array.from({length:LAST_SECTOR}, (_, i) => `<button class="rot" type="button" data-act="opt:t-s${i+1}">${i+1}</button>`).join('') + '</span></div>' : '') + '</div>';
}
let back: () => void = hideOverlay;
export const optionsOpen = () => !$('overlay').hidden && $('ovTitle').textContent === 'Options';
/** Opens Options; Back (or Esc) returns to `from`. */
export function showOptions(from: () => void = back){
  back = from;
  showOverlay('Options', '<div class="rows">' + OPTS.map(o => row(o.name, o.sub, o.val(), `opt:${o.id}`)).join('') + '</div>' + testRows(),
    [['Back', () => back()], ...(G.stats ? [['Abandon run', abandon, 'ghost reset'] as OverlayAction] : [])], false, {eye:'Options · saved in this browser'});
}
export const closeOptions = () => back();
export function flipOption(id: string){
  const s = /^t-s([0-9]{1,2})$/.exec(id); if (s){ startAt(+s[1]); return; }
  if (id.startsWith('t-')) TESTS[id.slice(2)]?.(); else OPTS.find(o => o.id===id)?.flip();
  showOptions();
}
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
