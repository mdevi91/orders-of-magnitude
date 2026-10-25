import { HEAD_OF, PAL, PLATE, RARITY, T, outfitPrice, rarName, rarOf, unlocked } from './catalog';
import { K } from './grid';
import { undoStack } from './input';
import { clearRun, load, save, saveMeta } from './save';
import { row } from './shop';
import { curNode, genMap, toDrydock, toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import type { BlockType, Key, StartDesign } from './types';
import { hideOverlay, showOverlay, syncUI, toast } from './ui';
import { $ } from './view';

// ---------- runs and the space base ----------
// Data is earned at the end of every run and buys permanent upgrades in Research & Development.
// Run upgrades help every run get going; ship upgrades make every block of every ship stronger.
interface MetaDef { id: string; name: string; desc: string; max: number; cost: number; ship?: boolean }
export const META: MetaDef[] = [
  {id:'cash', name:'Starting budget', desc:'+30 credits for building your starting ship in Engineering.', max:10, cost:3},
  {id:'arms', name:'Armory', desc:'Start with one more random weapon.', max:3, cost:6},
  {id:'trade', name:'Trade contacts', desc:'Shop prices −7%.', max:5, cost:5},
  {id:'salv', name:'Salvage rights', desc:'+8% credits from salvage and bounties.', max:5, cost:5},
  {id:'proto', name:'Prototype access', desc:'Rarer blocks turn up more often in loot and shops.', max:5, cost:7},
  {id:'core', name:'Hardened core', desc:'Core +25% hit points.', max:5, cost:5, ship:true},
  {id:'plating', name:'Hull plating', desc:'Every block +5% hit points, and so +5% life.', max:10, cost:3, ship:true},
  {id:'guns', name:'Weapon tuning', desc:'Every weapon +4% damage.', max:10, cost:3, ship:true},
  {id:'power', name:'Power grid', desc:'Energy recharge and storage +6%.', max:10, cost:3, ship:true},
  {id:'drive', name:'Thrusters', desc:'Engine thrust and gyro torque +5%.', max:10, cost:3, ship:true},
  {id:'shields', name:'Shield harmonics', desc:'Shield bubbles +8% strength.', max:5, cost:4, ship:true},
];
export function metaLv(id: string){ return G.meta.lv[id] || 0; }
export const metaCost = (m: MetaDef) => 2*m.cost*(metaLv(m.id) + 1);
const metaRow = (m: MetaDef) => row(m.name + (metaLv(m.id) ? ` Lv${metaLv(m.id)}/${m.max}` : ''), m.desc, metaLv(m.id) >= m.max ? 'max' : `${metaCost(m)} data`, `meta:${m.id}`, metaLv(m.id) >= m.max || metaCost(m) > G.meta.data);
// Blocks that join loot and shops once a run first reaches sector s.
const unlocksAt = (s: number) => PAL.filter(t => t!=='sell' && !PLATE(t) && (T[t].unlock || 1)===s);
function unlockLine(){
  const best = G.meta.best || 1, next = PAL.map(t => T[t].unlock || 1).filter(u => u > best).sort((a,b) => a-b)[0];
  return `Furthest sector reached: <b>${best}</b>.` + (next ? ` Reach sector ${next} to unlock ${unlocksAt(next).map(rarName).join(', ')}.` : ' Every block is unlocked.');
}
/** Record the sector a run has reached; returns the blocks that sector unlocks for the first time. */
export function reachSector(s: number){
  const best = G.meta.best || 1; if (s <= best) return [];
  G.meta.best = s; saveMeta();
  const got: BlockType[] = []; for (let n=best+1; n<=s; n++) got.push(...unlocksAt(n));
  return got;
}
// The main menu is the space base (base.ts): each doorway is a station.
export function showTitle(){
  G.mode = 'title'; G.ships = []; G.pb = []; G.eb = []; G.fx = []; hideOverlay(); syncUI(); tut('title');
  $('baseInfo').innerHTML = `<b class="gold">${G.meta.data} data</b> · ${unlockLine()}` + (G.stats ? ` · Run in progress: sector <b>${G.stage}</b>.` : '');
}
export function station(id: string){
  if (id==='hangar') hangar(); else if (id==='eng') enterEngineering(); else if (id==='rnd') showRnD(); else showCantina();
}
// Hangar: carry on with the run in progress, or launch a new one in the ship Engineering designed.
function hangar(){
  const st = startDesign(), left = budget() - designCost(new Map(st.d));
  if (G.stats) showOverlay('Hangar', `Your ship waits in sector <b>${G.stage}</b>.`, [['Continue run', () => { G.outfit = false; toMap(); }],
    ['New run', () => { if (confirm('Abandon the saved run? You keep the data you already have.')) newRun(); }, 'ghost'], ['Back', showTitle, 'ghost']]);
  else showOverlay('Hangar', `Your ${st.d.length}-block starting ship is fueled and ready. The <b class="gold">${Math.max(0, left)} cr</b> of budget it didn’t use comes with you. Redesign it in Engineering.`,
    [['Launch', newRun], ['Back', showTitle, 'ghost']]);
}
// Research & Development: the data upgrades, one section per kind.
export function showRnD(){
  const sec = (name: string, intro: string, ms: MetaDef[]) => `<h3>${name}</h3><small>${intro}</small>` + ms.map(metaRow).join('');
  showOverlay('Research & Development', `Data from every run, won or lost, pays for permanent upgrades. <b class="gold">${G.meta.data} data</b> available.` +
    '<div class="rows">' +
    sec('Logistics', 'Help every run get going.', META.filter(m => !m.ship)) +
    sec('Ship systems', 'Make every block of every ship stronger.', META.filter(m => m.ship)) + '</div>',
    [['Back', showTitle]], true);
}
// Cantina: your records, a rumor from the bar, and the ship deck.
const RUMORS = [
  'Pilots say armor plates shrug off a third of every hit. Wrap your core in them.',
  'Ion bolts jam the guns near where they hit. Aim them at a turret cluster.',
  'Flak bursts clear enemy bullets out of the sky.',
  'A ship explodes when its life runs out, core or not. Big hulls last longer.',
  'Shops in deeper sectors stock rarer blocks.',
  'Generators blow up and take their neighbours with them: shoot the enemy ones.',
  'Every third sector ends in a flagship or a starbase. Arrive repaired.',
  'Data buys more than you think. Research and Development never closes.',
];
export function showCantina(){
  const m = G.meta, best = m.best || 1, next = PAL.map(t => T[t].unlock || 1).filter(u => u > best).sort((a,b) => a-b)[0];
  const rumor = next && Math.random() < .4 ? `Word is that the sector ${next} yards build ${unlocksAt(next).map(rarName).join(' and ')}. Get there and they’re yours.` : RUMORS[(Math.random()*RUMORS.length)|0];
  const rec = (k: string, v: string | number) => `<div class="row"><span>${k}</span><b>${v}</b></div>`;
  showOverlay('Cantina', `The bar hums with pilots between jumps.<div class="rows"><h3>Records</h3>` +
    rec('Runs flown', m.runs || 0) + rec('Runs won', m.wins || 0) + rec('Furthest sector', best) + rec('Data earned', m.earned || 0) + rec('Ships destroyed', m.kills || 0) +
    `<h3>Overheard</h3><small>“${rumor}”</small></div>`,
    [['Ship deck', showDeck], ['Back', showTitle, 'ghost']], true);
}
// Ship deck: every block, what it does, how rare it is, and where it unlocks.
export function showDeck(){
  const best = G.meta.best || 1, ts = PAL.filter(t => t!=='sell' && !PLATE(t)).sort((a,b) => rarOf(a) - rarOf(b) || (T[a].unlock || 1) - (T[b].unlock || 1));
  const card = (t: BlockType) => `<div class="row${unlocked(t) ? '' : ' locked'}"><span>${rarName(t)} <i class="rar">${RARITY[rarOf(t)].name}</i><small>${unlocked(t) ? T[t].desc || '' : `Unlocks when a run reaches sector ${T[t].unlock}.`}</small></span></div>`;
  const open = ts.filter(unlocked), shut = ts.filter(t => !unlocked(t));
  showOverlay('Ship deck', `${open.length} of ${ts.length} blocks unlocked. Furthest sector reached: <b>${best}</b>. Unlocked blocks can turn up in loot and shops from sector 1 on, and Engineering can build them into your starting ship.` +
    '<div class="rows"><h3>Unlocked</h3>' + open.map(card).join('') + (shut.length ? '<h3>Locked</h3>' + shut.map(card).join('') : '') + '</div>',
    [['Back', showCantina]], true);
}
// ---------- Engineering: the starting ship ----------
// The design every run starts with, kept in the hangar save. It is paid for out of a small budget; what is left becomes the run's first credits.
const DEFAULT_START: StartDesign = {d:[[K(0,0),'core'],[K(0,-1),'cannon'],[K(-1,0),'hull'],[K(1,0),'hull'],[K(0,1),'engine']], o:[[K(0,-1),0],[K(0,1),0]]};
export const budget = () => 90 + 30*metaLv('cash');
/** What a design costs to build: plating at its price, every other block at the outfitting price (the core is free). */
export const designCost = (d: Map<Key, BlockType>) => { let c = 0; for (const t of d.values()) if (t!=='core' && !HEAD_OF[t]) c += PLATE(t) ? T[t].cost : outfitPrice(t); return c; };
// a saved design keeps only blocks that are still unlocked
export const startDesign = (): StartDesign => { const s = G.meta.start || DEFAULT_START; return {...s, d:s.d.filter(([, t]) => t==='core' || PLATE(t) || HEAD_OF[t] || unlocked(t))}; };
// Engineering borrows the drydock: the run in progress stays safe in storage and comes back on the way out.
let engRun = false;
export function enterEngineering(){
  engRun = !!G.stats; save();
  const st = startDesign();
  G.stats = null; G.stage = 1; G.lv = {}; G.inv = {}; G.dmg = {}; G.broken = new Set(); G.fresh = new Set(); G.grp = {...(st.g || {})};
  G.design = new Map(st.d); G.dirs = new Map(st.o);
  G.credits = budget() - designCost(G.design); G.outfit = true; undoStack.length = 0;
  toDrydock(); tut('eng');
}
export function leaveEngineering(){
  G.meta.start = {d:[...G.design], o:[...G.dirs], g:{...G.grp}}; saveMeta();
  G.outfit = false; undoStack.length = 0;
  if (!(engRun && load())) G.stats = null;
  toast('Starting ship saved'); showTitle();
}
export function newRun(){
  const st = startDesign();
  G.stage = 1; G.pendingNode = null; G.bounty = 0; G.lv = {}; G.broken = new Set(); G.fresh = new Set(); G.spanT = G.span0 = 0; G.spanStage = null;
  G.design = new Map(st.d); G.dirs = new Map(st.o);
  G.inv = {}; G.dmg = {}; G.grp = {...(st.g || {})}; G.auto = [false,false,false,true,false];
  for (let q=0; q<metaLv('arms'); q++){ const t = (['cannon','gatling','missile','flak'] as BlockType[])[(Math.random()*4)|0]; G.inv[t] = (G.inv[t]||0) + 1; }
  G.credits = Math.max(0, budget() - designCost(G.design)); G.outfit = false;
  G.stats = {kills:0, nodes:0, elites:0, flags:0, sectors:0, bonus:0, won:false};
  G.map = genMap(1); G.node = curNode(); undoStack.length = 0;
  toMap(); save();
}
export function runOver(why: 'dead' | 'won' | 'abandoned'){
  const st = G.stats; if (!st) return;
  const data = st.sectors*6 + st.elites*2 + st.flags*15 + Math.floor(st.nodes/2) + Math.floor(st.kills/8) + (st.bonus||0) + (st.won ? 25 : 0);
  const m = G.meta; m.data += data; m.earned = (m.earned || 0) + data; m.runs = (m.runs || 0) + 1; m.kills = (m.kills || 0) + st.kills; if (st.won) m.wins = (m.wins || 0) + 1;
  saveMeta(); clearRun(); tut('data');
  showOverlay(why==='dead' ? 'Core destroyed' : why==='won' ? 'Run complete' : 'Run abandoned',
    `Sector <b>${G.stage}</b>, ${st.nodes} jumps, ${st.kills} kills, ${st.flags} flagship${st.flags===1 ? '' : 's'}. You earned <b class="gold">${data} data</b> for research.`,
    [['Main menu', showTitle]]);
}
