// @ts-nocheck
import { K } from './grid';
import { undoStack } from './input';
import { clearRun, save, saveMeta } from './save';
import { row } from './shop';
import { curNode, genMap, toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import { showOverlay, syncUI } from './ui';

// ---------- runs and the hangar ----------
// Data is earned at the end of every run and buys permanent upgrades here.
export const META = [
  {id:'cash', name:'Seed money', desc:'+40 starting credits.', max:3, cost:4},
  {id:'core', name:'Hardened core', desc:'Core +25% hit points.', max:3, cost:5},
  {id:'arms', name:'Armory', desc:'Start with one more random weapon.', max:2, cost:6},
  {id:'trade', name:'Trade contacts', desc:'Shop prices −8%.', max:3, cost:5},
  {id:'frame', name:'Reinforced frame', desc:'+15 block limit.', max:3, cost:5},
  {id:'proto', name:'Prototype access', desc:'Loot and shops reach one tier further.', max:2, cost:8},
];
export function metaLv(id){ return G.meta.lv[id] || 0; }
export const metaCost = m => 2*m.cost*(metaLv(m.id) + 1);
export function showTitle(){
  tut('title');
  G.mode = 'title'; G.ships = []; G.pb = []; G.eb = []; G.fx = []; syncUI();
  const h = 'Cross nine sectors. Pick your route on each star map, salvage blocks, trade at shops and rebuild between jumps. A flagship guards every third sector. Lose the core and the run is over.' +
    `<div class="rows"><h3>Hangar · ${G.meta.data} data</h3>` +
    META.map(m => row(m.name + (metaLv(m.id) ? ` Lv${metaLv(m.id)}` : ''), m.desc, metaLv(m.id) >= m.max ? 'max' : `${metaCost(m)} data`, `meta:${m.id}`, metaLv(m.id) >= m.max || metaCost(m) > G.meta.data)).join('') + '</div>';
  showOverlay('Orders of Magnitude', h, G.stats ? [['Continue run', toMap], ['New run', () => { if (confirm('Abandon the saved run? You keep the data you already have.')) newRun(); }, 'ghost']] : [['New run', newRun]], true);
}
export function newRun(){
  G.stage = 1; G.pendingNode = null; G.bounty = 0; G.lv = {}; G.broken = new Set(); G.fresh = new Set(); G.spanT = G.span0 = 0; G.spanStage = null;
  G.design = new Map(); G.dirs = new Map();
  [[0,0,'core'],[0,-1,'cannon'],[-1,0,'hull'],[1,0,'hull'],[0,1,'engine']].forEach(([i,j,t]) => G.design.set(K(i,j),t));
  G.dirs.set(K(0,-1),0); G.dirs.set(K(0,1),0);
  G.inv = {cannon:1, engine:2, gen:1, battery:1}; G.dmg = {}; G.grp = {}; G.auto = [false,false,false,true,false];
  for (let q=0; q<metaLv('arms'); q++){ const t = ['cannon','gatling','missile','flak'][(Math.random()*4)|0]; G.inv[t] = (G.inv[t]||0) + 1; }
  G.credits = 80 + 40*metaLv('cash');
  G.stats = {kills:0, nodes:0, elites:0, flags:0, sectors:0, bonus:0, won:false};
  G.map = genMap(1); G.node = curNode(); undoStack.length = 0;
  toMap(); save();
}
export function runOver(why){
  const st = G.stats; if (!st) return;
  const data = st.sectors*3 + st.elites + st.flags*8 + Math.floor(st.nodes/3) + (st.bonus||0) + (st.won ? 10 : 0);
  G.meta.data += data; saveMeta(); clearRun(); tut('data');
  showOverlay(why==='dead' ? 'Core destroyed' : why==='won' ? 'Run complete' : 'Run abandoned',
    `Sector <b>${G.stage}</b>, ${st.nodes} jumps, ${st.kills} kills, ${st.flags} flagship${st.flags===1 ? '' : 's'}. You earned <b class="gold">${data} data</b> for the hangar.`,
    [['Hangar', showTitle]]);
}
