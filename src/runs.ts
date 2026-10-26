import { sfx } from './audio';
import { COCKPITS, HEAD_OF, PAL, PLATE, RARITY, T, blurb, type CockpitId, cpUnlocked, outfitPrice, rarName, rarOf, unlocked } from './catalog';
import { K } from './grid';
import { undoStack } from './input';
import { clearRun, load, resetAll, save, saveMeta } from './save';
import { tile } from './shop';
import { curNode, genMap, toDrydock, toMap } from './starmap';
import { G, blockCount } from './state';
import { tut } from './tutorial';
import type { BlockType, Key, StartDesign } from './types';
import { hideOverlay, honeycomb, icon, pad2, pips, showOverlay, syncUI, toast } from './ui';
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
// Blocks that join loot and shops once a run first reaches sector s.
const unlocksAt = (s: number) => PAL.filter(t => t!=='sell' && !PLATE(t) && (T[t].unlock || 1)===s);
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
}
export function station(id: string){
  if (id==='hangar') hangar(); else if (id==='eng') enterEngineering(); else if (id==='rnd') showRnD(); else showCantina();
}
// Hangar: carry on with the run in progress, or launch a new one in the ship Engineering designed.
function hangar(){
  const st = startDesign(), left = budget() - designCost(new Map(st.d));
  const ro = (v: string | number, k: string) => `<div class="readout"><b>${v}</b><span>${k}</span></div>`;
  if (G.stats) showOverlay('Hangar', `<div class="readouts">${ro(G.stage, 'Sector')}${ro(G.stats.nodes, 'Jumps')}${ro(G.stats.kills, 'Kills')}${ro(Math.round(G.credits), 'Credits')}</div>Your ship is still out there, waiting at the last beacon.`,
    [['Continue run', () => { G.outfit = false; toMap(); }], ['New run', () => { if (confirm('Abandon the saved run? You keep the data you already have.')) newRun(); }, 'ghost'], ['Back', showTitle, 'ghost']],
    false, {eye:'Hangar · run in progress', ac:STATION_AC.hangar});
  else showOverlay('Hangar', `<div class="readouts">${ro(st.d.length, 'Blocks')}${ro(Math.max(0, left), 'Credits aboard')}${ro(G.meta.best || 1, 'Best sector')}</div>Fueled and cleared for launch. The budget your design didn’t use rides along as credits. Change the design in Engineering.`,
    [['Launch', newRun], ['Back', showTitle, 'ghost']], false, {eye:'Hangar · launch bay', ac:STATION_AC.hangar});
}
// Research & Development: the data upgrades, one section per kind.
export function showRnD(){
  const t = (m: MetaDef) => { const lv = metaLv(m.id), max = lv >= m.max;
    return tile({name:m.name, tag:max ? 'Complete' : `Level ${lv} of ${m.max}`, desc:m.desc, foot:pips(lv, m.max), label:max ? 'max' : `${metaCost(m)} data`, act:`meta:${m.id}`, dis:max || metaCost(m) > G.meta.data}); };
  const spent = META.reduce((a, m) => a + metaLv(m.id), 0), total = META.reduce((a, m) => a + m.max, 0);
  showOverlay('Research & Development', `<div class="readouts"><div class="readout"><b class="gold">${G.meta.data}</b><span>Data</span></div><div class="readout"><b>${spent}/${total}</b><span>Projects done</span></div></div>` +
    '<div class="rows"><h3>Logistics</h3></div><div class="tiles">' + META.filter(m => !m.ship).map(t).join('') + '</div>' +
    '<div class="rows"><h3>Ship systems</h3></div><div class="tiles">' + META.filter(m => m.ship).map(t).join('') + '</div>',
    [['Back', showTitle]], true, {eye:'Station · Research & Development', ac:STATION_AC.rnd});
}
// Cantina: your records, a rumor from the bar, and the ship deck.
const PILOTS = ['Vex, freighter captain', 'a bored dockhand', 'Okafor, ex-navy gunner', 'a pilot nursing a drink', 'Lin, salvage crew', 'the bartender'];
// station accent colours, matching their doorways in the base
const STATION_AC = {cantina:'var(--line)', rnd:'var(--line)', eng:'var(--line)', hangar:'var(--line)'};
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
  const ro = (v: string | number, k: string) => `<div class="readout"><b>${v}</b><span>${k}</span></div>`;
  const who = PILOTS[(Math.random()*PILOTS.length)|0];
  // wiping every save takes three clicks; the button counts down
  let wipe = 0;
  const reset = () => { if (++wipe >= 3) return resetAll(); $('ovActions').lastElementChild!.textContent = wipe===1 ? 'Erase all progress? Click 2 more times' : 'Last chance: click once more'; sfx('hit'); };
  showOverlay('Cantina', `<div class="rows"><h3>Your record</h3></div><div class="readouts">${ro(m.runs || 0, 'Runs')}${ro(m.wins || 0, 'Won')}${ro(best, 'Best sector')}${ro(m.earned || 0, 'Data earned')}${ro(m.kills || 0, 'Kills')}</div>` +
    `<div class="rows"><h3>Overheard at the bar</h3></div><blockquote class="quote">“${rumor}”<cite>— ${who}</cite></blockquote>`,
    [['Ship deck', showDeck], ['Back', showTitle, 'ghost'], ['Reset everything', reset, 'ghost reset']], true, {eye:'Station · Cantina', ac:STATION_AC.cantina});
}
// Ship deck: every block, what it does, how rare it is, and where it unlocks.
export function showDeck(){
  const best = G.meta.best || 1, ts = PAL.filter(t => t!=='sell' && !PLATE(t)).sort((a,b) => rarOf(a) - rarOf(b) || (T[a].unlock || 1) - (T[b].unlock || 1));
  const card = (t: BlockType) => tile({ic:icon(t), rc:RARITY[rarOf(t)].col, name:T[t].name, tag:RARITY[rarOf(t)].name + (T[t].make ? ' · ' + T[t].make : ''), locked:!unlocked(t), label:'', act:'',
    desc:unlocked(t) ? blurb(t) : `Locked. Reach sector ${T[t].unlock} to unlock it.`});
  const open = ts.filter(unlocked), shut = ts.filter(t => !unlocked(t));
  showOverlay('Ship deck', `<div class="readouts"><div class="readout"><b>${open.length}/${ts.length}</b><span>Blocks unlocked</span></div><div class="readout"><b>${best}</b><span>Best sector</span></div></div>` +
    'Unlocked blocks turn up in loot and shops from sector 1 on, and Engineering can build them into your starting ship.' +
    '<div class="rows"><h3>Unlocked</h3></div><div class="tiles">' + open.map(card).join('') + '</div>' + (shut.length ? '<div class="rows"><h3>Locked</h3></div><div class="tiles">' + shut.map(card).join('') + '</div>' : ''),
    [['Back', showCantina]], true, {eye:'Cantina · ship deck', ac:STATION_AC.cantina});
}
// ---------- Engineering: the starting ship ----------
// The design every run starts with, kept in the hangar save. It is paid for out of a small budget; what is left becomes the run's first credits.
// The default design costs 53, so a fresh hangar starts runs with 50 credits.
const DEFAULT_START: StartDesign = {d:[[K(0,0),'core'],[K(0,-1),'cannon'],[K(-1,0),'hull'],[K(1,0),'hull'],[K(0,1),'engine']], o:[[K(0,-1),0],[K(0,1),0]]};
export const budget = () => 103 + 30*metaLv('cash');
/** What a design costs to build: plating at its price, every other block at the outfitting price (the core is free). */
export const designCost = (d: Map<Key, BlockType>) => { let c = 0; for (const t of d.values()) if (t!=='core' && !HEAD_OF[t]) c += PLATE(t) ? T[t].cost : outfitPrice(t); return c; };
// a saved design keeps only blocks that are still unlocked
const keepUnlocked = (s: StartDesign): StartDesign => ({...s, d:s.d.filter(([, t]) => t==='core' || PLATE(t) || HEAD_OF[t] || unlocked(t))});
export const startDesign = (): StartDesign => { const s = G.meta.start || DEFAULT_START; return {...keepUnlocked(s), c:s.c && cpUnlocked(s.c) ? s.c : 'std'}; };
// Engineering borrows the drydock: the run in progress stays safe in storage and comes back on the way out.
let engRun = false;
export function enterEngineering(){
  engRun = !!G.stats; save();
  const st = startDesign();
  G.stats = null; G.stage = 1; G.lv = {}; G.inv = {}; G.dmg = {}; G.broken = new Set(); G.fresh = new Set(); G.grp = {...(st.g || {})};
  G.design = new Map(st.d); G.dirs = new Map(st.o); G.cockpit = st.c || 'std'; G.paint = st.p || 'steel';
  G.credits = budget() - designCost(G.design); G.outfit = true; undoStack.length = 0;
  toDrydock(); tut('eng');
}
const shipNow = (): StartDesign => ({d:[...G.design], o:[...G.dirs], g:{...G.grp}, c:G.cockpit, p:G.paint});
/** Engineering: picking another cockpit files the current ship under the old one and brings back the ship built for the new one. */
export function switchCockpit(id: CockpitId){
  if (id === G.cockpit) return;
  const m = G.meta, builds = m.builds ??= {};
  builds[G.cockpit] = shipNow(); G.cockpit = id;
  const b = builds[id];
  if (b){ const f = keepUnlocked(b); G.design = new Map(f.d); G.dirs = new Map(f.o); G.grp = {...(f.g || {})}; }
  G.credits = budget() - designCost(G.design); undoStack.length = 0; saveMeta();
  toast(b ? `Your ${COCKPITS[id].name} ship` : `First ${COCKPITS[id].name} ship: starting from the last one`); syncUI();
}
export function leaveEngineering(){
  G.meta.start = shipNow(); (G.meta.builds ??= {})[G.cockpit] = shipNow(); saveMeta();
  G.outfit = false; undoStack.length = 0;
  if (!(engRun && load())) G.stats = null;
  toast('Starting ship saved'); showTitle();
}
export function newRun(){
  const st = startDesign();
  G.stage = 1; G.pendingNode = null; G.bounty = 0; G.lv = {}; G.broken = new Set(); G.fresh = new Set(); G.spanT = G.span0 = 0; G.spanStage = null;
  G.design = new Map(st.d); G.dirs = new Map(st.o); G.cockpit = st.c || 'std'; G.paint = st.p || 'steel';
  G.inv = {}; G.dmg = {}; G.grp = {...(st.g || {})}; G.auto = [false,false,false,true,false];
  const arms = (['cannon','scatter','gatling','missile','flak'] as BlockType[]).filter(unlocked);
  for (let q=0; q<metaLv('arms'); q++){ const t = arms[(Math.random()*arms.length)|0]; G.inv[t] = (G.inv[t]||0) + 1; }
  G.credits = Math.max(0, budget() - designCost(G.design)); G.outfit = false;
  G.stats = {kills:0, nodes:0, elites:0, flags:0, sectors:0, bonus:0, won:false, dealt:0, taken:0, lost:0, secs:0, peak:blockCount(), best0:G.meta.best || 1};
  G.map = genMap(1); G.node = curNode(); undoStack.length = 0;
  toMap(); save();
}
export function runOver(why: 'dead' | 'won' | 'abandoned'){
  const st = G.stats; if (!st) return;
  const data = st.sectors*6 + st.elites*2 + st.flags*15 + Math.floor(st.nodes/2) + Math.floor(st.kills/8) + (st.bonus||0) + (st.won ? 25 : 0);
  const m = G.meta; m.data += data; m.earned = (m.earned || 0) + data; m.runs = (m.runs || 0) + 1; m.kills = (m.kills || 0) + st.kills; if (st.won) m.wins = (m.wins || 0) + 1;
  saveMeta(); clearRun(); tut('data');
  const n = (v?: number) => Math.round(v || 0).toLocaleString('en');
  const secs = Math.round(st.secs || 0), time = `${Math.floor(secs/60)}:${String(secs % 60).padStart(2, '0')}`;
  // what reaching new sectors opened up for good: blocks and cockpits
  const b0 = st.best0 ?? (m.best || 1), b1 = m.best || 1, newB = PAL.filter(t => t!=='sell' && !PLATE(t) && (T[t].unlock || 1) > b0 && (T[t].unlock || 1) <= b1);
  const newC = (Object.keys(COCKPITS) as CockpitId[]).filter(id => !COCKPITS[id].off && COCKPITS[id].unlock > b0 && COCKPITS[id].unlock <= b1);
  const next = PAL.map(t => T[t].unlock || 1).filter(u => u > b1).sort((a,b) => a-b)[0];
  // full screen: the verdict huge on the left with a terse system log; hexagon stats, status, combat log and unlocks on the right
  const dead = why==='dead', won = why==='won', tag = (t: string, cls = '') => `<span class="stag ${cls}">${t}</span>`;
  const head = dead ? ['Ship', 'lost'] : won ? ['Run', 'won'] : ['Run', 'ended'];
  const pairs: [string, string, string?][] = [['Damage dealt', n(st.dealt)], ['Damage taken', n(st.taken), 'red'], ['Blocks lost', n(st.lost), 'red'], ['Time in combat', time], ['Biggest ship', `${n(st.peak)} blk`]];
  const tags = newB.map(t => `<span class="ptag">${T[t].name}</span>`).join('') + newC.map(id => `<span class="ptag fill">Cockpit: ${COCKPITS[id].name.replace(/ (cockpit|bridge|deck)$/, '')}</span>`).join('');
  const s = `<div class="rep-left"><div>${dead ? tag('Emergency', 'red fill') + tag('Core signal lost', 'red') : tag(won ? 'Mission complete' : 'Recalled', 'fill')}</div>` +
    `<span class="rep-lbl">After-action report</span><h2 class="rep-h${dead ? ' red' : ''}">${head[0]}<br>${head[1]}</h2>` +
    `<p class="log">${dead ? '&gt; BLACK BOX RECOVERED<br>' : ''}&gt; SENSOR LOG UPLINKED TO R&amp;D <b>+${data}</b>${dead ? '<br><span class="red">&gt; PILOT STATUS: UNKNOWN</span>' : ''}</p></div>` +
    `<div class="rep-right"><div class="rep-top">${honeycomb([['Sector', pad2(G.stage)], ['Jumps', pad2(st.nodes)], ['Kills', pad2(st.kills)], ['Elites', pad2(st.elites)], ['Capitals', pad2(st.flags)], ['Data', '+' + data, true]])}` +
    `<div class="rep-status">${tag(dead ? 'Warning' : 'Status', dead ? 'red' : '')}<p class="log">HULL&nbsp;&nbsp;&nbsp;${dead ? '000.0%' : 'INTACT'}<br>CORE&nbsp;&nbsp;&nbsp;${dead ? 'OFFLINE' : 'ONLINE'}<br>SECTOR&nbsp;${pad2(G.stage)}<br><span class="${dead ? 'red' : ''}">STATUS ${dead ? 'LOST' : won ? 'VICTORIOUS' : 'RECALLED'}</span></p></div></div>` +
    `<h3>Combat log</h3><div class="rep-grid">${pairs.map(([k, v, c]) => `<span>${k}</span><b class="${c || ''}">${v}</b>`).join('')}</div>` +
    `<h3>New patterns registered <small>${pad2(newB.length + newC.length)}</small></h3>` +
    (tags ? `<div class="ptags">${tags}</div>` : `<p class="log">&gt; NOTHING NEW${next ? ` · REACH SECTOR ${pad2(next)} FOR ${unlocksAt(next).map(t => T[t].name.toUpperCase()).join(', ')}` : ''}</p>`) + '</div>';
  showOverlay(dead ? 'Ship lost' : won ? 'Run complete' : 'Run abandoned', s, [['Return to base', showTitle]], true, {screen:'report', ac:dead ? 'var(--foe)' : 'var(--line)'});
}
