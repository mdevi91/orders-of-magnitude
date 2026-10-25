import { sfx } from './audio';
import { T } from './catalog';
import { runEvent } from './events';
import { startFight } from './fights';
import { clamp, rand } from './grid';
import { shipWeapons } from './groups';
import { repairDock, salvage } from './loot';
import { reachSector } from './runs';
import { save } from './save';
import { openShop } from './shop';
import { G } from './state';
import { tut } from './tutorial';
import { hideOverlay, showOverlay, syncUI, toast } from './ui';
import type { FightKind, MapNode, NodeType, StarMap } from './types';
import { $ } from './view';

// ---------- star map ----------
interface NodeDef { name: string; col?: string; g?: string; desc?: string }
export const NODE = {
  start:  {name:'Jump point', col:'#9aa8d0', g:'o', desc:'Where you entered the sector.'},
  fight:  {name:'Hostiles', col:'#ff7a66', g:'!', desc:'A fight. Salvage, and maybe a block.'},
  elite:  {name:'Elite', col:'#ff9a3a', g:'!', desc:'One tough warship and an escort. Better loot.'},
  shop:   {name:'Shop', col:'#ffc46b', g:'$', desc:'Buy, sell, upgrade and repair.'},
  event:  {name:'Signal', col:'#5fd8ff', g:'?', desc:'An unknown signal. Could be anything.'},
  salvage:{name:'Wreckage', col:'#7fe07a', g:'*', desc:'Free salvage, unless someone is guarding it.'},
  repair: {name:'Repair dock', col:'#8ff0c8', g:'+', desc:'Fixes every damaged block for free.'},
  gate:   {name:'Sector gate', col:'#ff5a3a', g:'>', desc:'Guarded by a capital ship. Clear it to leave the sector.'},
  boss:   {name:'Flagship', col:'#ff3d8a', g:'B', desc:'The enemy flagship, huge and escorted by its hangars. Beat it to leave the sector.'},
  station:{name:'Starbase', col:'#ff3d8a', g:'S', desc:'A fortified enemy starbase. It never moves, but it is enormous and full of hangars. Destroy it to leave the sector.'},
  ambush: {name:'Ambush'},
} satisfies Record<string, NodeDef>;
/** A beacon type's look and text (every type the map places has all of them). */
export const nodeDef = (t: NodeType) => NODE[t] as Required<NodeDef>;
export const COLS = 7;
// FTL-style beacon map: columns of 2-4 beacons, each linked to the nearest ones in the next column, the gate at the far end.
export function genMap(s: number): StarMap {
  // types start empty and are dealt out once the lanes are drawn
  const nodes: (Omit<MapNode,'type'> & {type: NodeType | null})[] = [{id:0, col:0, x:0, y:.5, type:'start', links:[]}];
  for (let c=1; c<COLS-1; c++){
    const n = 2 + ((Math.random()*3)|0);
    for (let q=0; q<n; q++) nodes.push({id:nodes.length, col:c, x:(c + rand(-.2,.2))/(COLS-1), y:clamp((q + .5 + rand(-.25,.25))/n, .04, .96), type:null, links:[]});
  }
  nodes.push({id:nodes.length, col:COLS-1, x:1, y:.5, type:s%3===0 ? (Math.random() < .45 ? 'station' : 'boss') : 'gate', links:[]});
  type N = typeof nodes[number];
  const colN = (c: number) => nodes.filter(n => n.col===c), near = (L: N[], y: number) => [...L].sort((p,q) => Math.abs(p.y-y) - Math.abs(q.y-y));
  for (let c=0; c<COLS-1; c++){
    const A = colN(c), B = colN(c+1);
    for (const a of A){
      const by = near(B, a.y); a.links.push(by[0].id);
      if (by[1] && Math.abs(by[1].y-a.y) < .4 && Math.random() < .55) a.links.push(by[1].id);
    }
    for (const b of B) if (!A.some(a => a.links.includes(b.id))) near(A, b.y)[0].links.push(b.id);
  }
  // the first jump is always a fight, elites only show up past the middle, and the column before the gate always offers a shop or repair dock
  const odds: [NodeType, number][] = [['fight',42],['event',20],['shop',12],['salvage',9],['elite',13],['repair',4]];
  const pick = (c: number): NodeType => {
    const pool = odds.filter(([t]) => !(t==='elite' && c < 3));
    let r = Math.random()*pool.reduce((a,[,w]) => a+w, 0);
    for (const [t,w] of pool) if ((r -= w) < 0) return t;
    return 'fight';
  };
  for (const n of nodes) if (!n.type) n.type = n.col===1 ? 'fight' : pick(n.col);
  const last = colN(COLS-2);
  if (!last.some(n => n.type==='shop' || n.type==='repair')) last[(Math.random()*last.length)|0].type = Math.random() < .6 ? 'shop' : 'repair';
  if (!nodes.some(n => n.type==='shop')){ const mid = nodes.filter(n => n.col >= 2 && n.col <= 4); mid[(Math.random()*mid.length)|0].type = 'shop'; }
  return {nodes: nodes as MapNode[], cur:0, done:false, seen:[0]};
}
export const curNode = () => G.map!.nodes[G.map!.cur];
export const exitNode = (n: MapNode) => n.type==='gate' || n.type==='boss' || n.type==='station';
export const canJump = (n: MapNode) => curNode().links.includes(n.id) && !exitNode(curNode());
export function jumpTo(n: MapNode){
  if (!canJump(n)) return;
  G.map!.cur = n.id; G.map!.seen.push(n.id); G.node = n; G.stats!.nodes++; G.mapHover = null; sfx('launch');
  save();
  // random encounters on the way: raiders intercept a quiet jump, or a signal comes in mid-jump; the beacon waits until it is dealt with
  const r = Math.random(), quiet = n.type!=='fight' && n.type!=='elite' && !exitNode(n);
  if (quiet && r < .15){ G.pendingNode = n; showOverlay('Intercepted', 'Raiders drop out of the jump lane across your path.', [['Fight', () => startFight('ambush')]]); return; }
  if (r > .85){ G.pendingNode = n; runEvent({id:-1, col:n.col, x:0, y:0, type:'event', links:[]}); return; }
  enterNode(n);
}
// after an encounter on the way, carry on to the beacon the jump was headed for
export function goOn(){ const n = G.pendingNode; G.pendingNode = null; if (n) enterNode(n); else toMap(); }
export function enterNode(n: MapNode){
  G.node = n;
  if (n.type==='fight' || n.type==='elite' || exitNode(n)) startFight(n.type as FightKind);
  else if (n.type==='shop') openShop(n);
  else if (n.type==='event') runEvent(n);
  else if (n.type==='salvage') salvage(n);
  else if (n.type==='repair') repairDock(n);
}
// what the current beacon still offers: reopen the shop, answer a signal, fight or pass the gate
export function mapAction(){
  const n = curNode();
  if (exitNode(n)) G.map!.done ? nextSector() : startFight(n.type as FightKind);
  else if (n.type==='shop') openShop(n);
  else if (n.type==='event' && !n.used) runEvent(n);
}
export function nextSector(){
  G.stage++; G.map = genMap(G.stage); G.node = curNode(); tut('sector');
  toMap(); toast(`Sector ${G.stage}${G.stage%3===0 ? ': a capital fight waits at the end' : ''}`); save();
  // a first visit to this sector unlocks new blocks for good: they can drop from here on, in this run and every later one
  const got = reachSector(G.stage);
  if (got.length) setTimeout(() => { sfx('unlock'); toast(`Unlocked: ${got.map(t => T[t].name).join(', ')}`); }, 1800);
}
export function toMap(){
  G.mode = 'map'; G.paused = false; hideOverlay(); G.mapHover = null;
  G.ships = []; G.pb = []; G.eb = []; G.fx = []; G.boss = null;
  syncUI(); tut('map');
}
export function toDrydock(){
  G.mode = 'build'; G.paused = false; hideOverlay();
  syncUI(); tut('dock'); if (shipWeapons().length) tut('groups');
  if (G.fresh.size) setTimeout(() => sfx('unlock'), 300);
  [...G.fresh].forEach((t,n) => {
    const b = $('pal-'+t); if (!b) return;
    b.classList.remove('fresh'); void b.offsetWidth;
    b.style.setProperty('--d', (.3 + n*.25)+'s'); b.classList.add('fresh');
    b.addEventListener('click', () => b.classList.remove('fresh'), {once:true});
  });
  G.fresh.clear();
}
