import { PAL, PLATE, T, rarName } from './catalog';
import { K } from './grid';
import { undoStack } from './input';
import { clearRun, save, saveMeta } from './save';
import { row } from './shop';
import { curNode, genMap, toDrydock, toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import type { BlockType } from './types';
import { showOverlay, syncUI } from './ui';

// ---------- runs and the hangar ----------
// Data is earned at the end of every run and buys permanent upgrades here.
// Run upgrades help every run get going; ship upgrades make every block of every ship stronger.
interface MetaDef { id: string; name: string; desc: string; max: number; cost: number; ship?: boolean }
export const META: MetaDef[] = [
  {id:'cash', name:'Starting budget', desc:'+50 credits to outfit your starting ship.', max:10, cost:3},
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
  return `<small>Furthest sector reached: <b>${best}</b>.` + (next ? ` Reach sector ${next} to unlock ${unlocksAt(next).map(rarName).join(', ')}.` : ' Every block is unlocked.') + '</small>';
}
/** Record the sector a run has reached; returns the blocks that sector unlocks for the first time. */
export function reachSector(s: number){
  const best = G.meta.best || 1; if (s <= best) return [];
  G.meta.best = s; saveMeta();
  const got: BlockType[] = []; for (let n=best+1; n<=s; n++) got.push(...unlocksAt(n));
  return got;
}
export function showTitle(){
  tut('title');
  G.mode = 'title'; G.ships = []; G.pb = []; G.eb = []; G.fx = []; syncUI();
  const h = 'Cross nine sectors. Pick your route on each star map, salvage blocks, trade at shops and rebuild between jumps. A flagship guards every third sector. Every block adds to your ship’s life: lose it all, or the core, and the run is over. New blocks unlock as you reach deeper sectors.' +
    `<div class="rows"><h3>Hangar · ${G.meta.data} data</h3>` + unlockLine() +
    '<h3>Run</h3>' + META.filter(m => !m.ship).map(metaRow).join('') + '<h3>Ship</h3>' + META.filter(m => m.ship).map(metaRow).join('') + '</div>';
  showOverlay('Orders of Magnitude', h, G.stats ? [['Continue run', () => G.outfit ? toDrydock() : toMap()], ['New run', () => { if (confirm('Abandon the saved run? You keep the data you already have.')) newRun(); }, 'ghost']] : [['New run', newRun]], true);
}
export function newRun(){
  G.stage = 1; G.pendingNode = null; G.bounty = 0; G.lv = {}; G.broken = new Set(); G.fresh = new Set(); G.spanT = G.span0 = 0; G.spanStage = null;
  G.design = new Map(); G.dirs = new Map();
  ([[0,0,'core'],[0,-1,'cannon'],[-1,0,'hull'],[1,0,'hull'],[0,1,'engine']] as const).forEach(([i,j,t]) => G.design.set(K(i,j),t));
  G.dirs.set(K(0,-1),0); G.dirs.set(K(0,1),0);
  G.inv = {}; G.dmg = {}; G.grp = {}; G.auto = [false,false,false,true,false];
  for (let q=0; q<metaLv('arms'); q++){ const t = (['cannon','gatling','missile','flak'] as BlockType[])[(Math.random()*4)|0]; G.inv[t] = (G.inv[t]||0) + 1; }
  // the run opens in the drydock: spend the starting budget on any unlocked blocks, and keep what is left
  G.credits = 200 + 50*metaLv('cash'); G.outfit = true;
  G.stats = {kills:0, nodes:0, elites:0, flags:0, sectors:0, bonus:0, won:false};
  G.map = genMap(1); G.node = curNode(); undoStack.length = 0;
  toDrydock(); save(); tut('outfit');
}
export function runOver(why: 'dead' | 'won' | 'abandoned'){
  const st = G.stats; if (!st) return;
  const data = st.sectors*6 + st.elites*2 + st.flags*15 + Math.floor(st.nodes/2) + Math.floor(st.kills/8) + (st.bonus||0) + (st.won ? 25 : 0);
  G.meta.data += data; saveMeta(); clearRun(); tut('data');
  showOverlay(why==='dead' ? 'Core destroyed' : why==='won' ? 'Run complete' : 'Run abandoned',
    `Sector <b>${G.stage}</b>, ${st.nodes} jumps, ${st.kills} kills, ${st.flags} flagship${st.flags===1 ? '' : 's'}. You earned <b class="gold">${data} data</b> for the hangar.`,
    [['Hangar', showTitle]]);
}
