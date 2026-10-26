import { setAuto, setBrush, shipWeapons, toggleGroup } from './groups';
import { G } from './state';
import { toast } from './ui';
import { $ } from './view';

// ---------- tutorial ----------
// One tip the first time each screen or mechanic comes up, remembered in this browser. Skip turns them all off.
export const TUT: Record<string, [title: string, text: string]> = {
  title:['Welcome aboard', 'This is your base. Walk into the <b>Hangar</b> to launch a run, <b>Engineering</b> to design the ship every run starts with, <b>Research &amp; Development</b> to spend data on upgrades, and the <b>Cantina</b> for records and rumors.'],
  map:['Star map', 'Click a beacon linked to yours to jump there: <b>!</b> fight, <b>$</b> shop, <b>?</b> signal, <b>*</b> wreckage, <b>+</b> repair dock. Reach the gate on the far right to leave the sector. <b>Open drydock</b> (or <b>D</b>) to rebuild between jumps.'],
  combat:['Fighting', '<b>W/S</b> thrust, <b>A/D</b> turn the ship. Hold <b>Shift</b> and the ship turns toward the mouse while <b>A/D</b> slide sideways. Aim with the mouse and click or hold <b>Space</b> to fire; <b>T</b> turns on auto-aim. On touch, drag to move. The mouse wheel or <b>+ / −</b> zooms. Destroy every hostile to win. Every block adds to your ship’s life (the blue bar); damage anywhere takes from it. Lose all your life, or the core, and the run is over.'],
  loot:['Loot', 'Choose one of the offered blocks, or skip. It goes into cargo, ready to fit in the drydock.'],
  dock:['Drydock', 'Pick a block in the list (the number is how many you have in cargo), then click a cell touching your ship to place it. <b>R</b> turns turrets and engines, <b>M</b> sets mirroring, right-click puts a block back in cargo. Hull and armor cost credits.'],
  groups:['Weapon groups', 'Under the tools, <b>Weapon groups</b>: pick a group number, then click weapons on the ship to put them in it. Set a group to <b>Auto</b> and it fires by itself at the nearest hostile; <b>Man</b> groups fire when you do. Keys <b>1-5</b> switch groups during a fight.'],
  shop:['Shop', 'Buy blocks, upgrade a block type (+35% per level, up to Lv5), repair damaged blocks at half price, or sell spare cargo.'],
  signal:['Signals', 'Signals are random events. A choice can pay off in credits and blocks, or go badly.'],
  damage:['Damage', 'Blocks destroyed in a fight stay damaged: dark, cracked, and left behind until repaired. Repair them in the drydock, at a shop for half price, or for free at a repair dock.'],
  sector:['New sector', 'Each sector is harder. Every third sector ends in a flagship or a starbase.'],
  eng:['Engineering', 'Design the ship every run starts with. Every block you have unlocked is for sale, paid from a small budget that Research &amp; Development can grow. What you leave unspent comes along as credits. <b>Save design</b> keeps it for every run.'],
  data:['Data', 'Every run earns data, even a lost one. Spend it in the hangar on permanent upgrades, then try again.'],
};
export let tutSeen: Record<string, boolean> = {}, tutOff = false, tutQ: string[] = [];
/** Options: tips on or off (turning them on again does not replay the ones already seen). */
export function setTutOff(v: boolean){ tutOff = v; if (v){ tutQ = []; tutShow(); } tutSave(); }
export const tutSave = () => { try { localStorage.setItem('oom-tut', JSON.stringify({seen:tutSeen, off:tutOff})); } catch {} };
export function tut(id: string){
  if (tutOff || tutSeen[id] || tutQ.includes(id)) return;
  tutQ.push(id); if (tutQ.length === 1) tutShow();
}
export function tutShow(){
  const id = tutQ[0];
  $('tut').hidden = !id; if (!id) return;
  $('tut').style.top = Math.round($('hud').getBoundingClientRect().bottom + 8) + 'px'; // clear of the HUD, however tall it wraps
  $('tutTitle').textContent = TUT[id][0]; $('tutText').innerHTML = TUT[id][1];
}

// wiring that runs once at start-up
export function init(){
  try { const s = JSON.parse(localStorage.getItem('oom-tut') || '{}'); tutSeen = s.seen || {}; tutOff = !!s.off; } catch {}
  $('tutOk').addEventListener('click', () => { const id = tutQ.shift(); if (id) tutSeen[id] = true; tutSave(); tutShow(); });
  $('tutSkip').addEventListener('click', () => { tutOff = true; tutQ = []; tutSave(); tutShow(); });
  $('tutReset').addEventListener('click', () => { tutSeen = {}; tutOff = false; tutSave(); toast('Tutorial tips will show again'); tut('dock'); if (shipWeapons().length) tut('groups'); });
  for (const id of ['grps','groups']) $(id).addEventListener('click', e => {
    const b = (e.target as Element).closest('button'); if (!b) return;
    if (b.dataset.b) setBrush(+b.dataset.b===G.grpBrush ? 0 : +b.dataset.b);
    else if (b.dataset.a) toggleGroup(+b.dataset.a);
  });
  try { setAuto(localStorage.getItem('oom-auto') === '1', false); } catch { setAuto(false, false); }
}
