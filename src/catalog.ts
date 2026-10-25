import { BS } from './grid';
import { metaLv } from './runs';
import { G } from './state';
import type { BlockDef, BlockType, Cell, CraftDef, CraftKind, EnemyCell, EnemyGun, EnemyGunDef, Key, PartDef } from './types';

// ---------- block catalogue ----------
// BLOCKS keeps its literal keys (they become the BlockType union); T is the same table read as BlockDefs.
export const BLOCKS = {
  core:   {name:'Core', cost:0, hp:80, mass:3, thrust:4, torque:12, gun:{range:220, cd:.35, spd:600, dmg:4, spread:.03, r:2, arc:Math.PI}, desc:'Your heart. Lose it, or all of the ship’s life, and the run is over. Gives a little thrust in every direction.'},
  hull:   {name:'Hull', key:'1', unlock:1, rar:0, cost:4, hp:22, mass:1, desc:'Cheap structure that holds everything together.'},
  armor:  {name:'Armor', key:'2', unlock:1, rar:0, cost:10, hp:70, mass:3, desc:'Three times the toughness of hull, and takes 30% less damage. Heavy.'},
  cannon: {name:'Cannon', key:'3', unlock:1, rar:0, cost:33, hp:20, mass:1.5, rot:true, gun:{range:324, cd:.54, en:3, spd:480, dmg:9, spread:.02, r:2.8, arc:.9, fx:'oval'}, desc:'Turret. Heavy slugs that splash and shove, 17 damage per second. Covers 50° either side of its facing.'},
  bigcannon:{name:'Big cannon', key:'k', unlock:4, rar:2, cost:120, hp:30, mass:3, rot:true, gun:{range:480, cd:1.3, en:9, spd:400, dmg:32, spread:.015, r:4.2, arc:.7, fx:'oval'}, desc:'Inverted T: a 3-wide base with a 2-cell nose ahead of it. Turret firing huge slugs, about 25 damage per second, from the tip of its nose. Covers 40° either side of its facing.'},
  hgatling:{name:'Heavy gatling', key:'u', unlock:3, rar:2, cost:95, hp:22, mass:2.5, rot:true, gun:{range:280, cd:.1, en:1.1, spd:700, dmg:3.8, spread:.035, r:2, arc:1.05, fx:'line'}, desc:'2 blocks long. Turret with a hammering tracer stream, 38 damage per second. Covers 60° either side of its facing.'},
  gatling:{name:'Gatling', key:'4', unlock:1, rar:0, cost:51, hp:16, mass:1.5, rot:true, gun:{range:273, cd:.15, en:1, spd:760, dmg:3.6, spread:.03, r:1.8, arc:1.25, fx:'line'}, desc:'Turret. Tight tracer stream, 24 damage per second. Covers 70° either side of its facing.'},
  missile:{name:'Missile', key:'5', unlock:1, rar:1, cost:72, hp:16, mass:2, gun:{range:1100, cd:2.9, en:8, spd:172, dmg:20, spread:.6, r:3.2, homing:true, arc:Math.PI}, desc:'Slow warheads that home for 2 s, then fly straight and blow up in a wide blast. Launch in any direction and fly over your own hull.'},
  mirv:   {name:'MIRV', key:'v', unlock:6, rar:3, cost:180, hp:18, mass:2.5, gun:{range:1000, cd:7, en:22, spd:142, dmg:7, spread:.4, r:3.6, homing:true, arc:Math.PI, mirv:3}, desc:'2×2 launcher. A slow carrier missile that splits into 3 homing warheads near its target, each with its own blast. Enemy point defense can shoot them down.'},
  flak:   {name:'Flak', key:'f', unlock:2, rar:1, cost:45, hp:18, mass:1.5, rot:true, gun:{range:460, cd:.8, en:4, spd:420, dmg:7, spread:.08, r:2.2, arc:1.1, fx:'flak', fuse:22, blast:26, nofall:true}, desc:'Turret. Shells burst near enemy ships, damaging every block in the blast and wiping out enemy bullets. Covers 63° either side of its facing.'},
  scatter:{name:'Scatter gun', key:'c', unlock:1, rar:0, cost:40, hp:18, mass:1.5, rot:true, gun:{range:170, cd:1.1, en:4, spd:520, dmg:3.2, spread:.04, r:1.6, arc:1, fx:'pellet', pellets:7, fan:.32}, desc:'Turret. Blasts 7 pellets in a wide cone: about 20 damage per second up close, nothing at range. Covers 57° either side of its facing.'},
  ion:    {name:'Ion cannon', key:'i', unlock:1, rar:2, cost:85, hp:18, mass:1.5, rot:true, gun:{range:380, cd:1.4, en:9, spd:420, dmg:6, spread:.03, r:2.6, arc:.8, fx:'ion', ion:true}, desc:'Turret. Ion bolts do 5× damage to shield bubbles and jam the enemy weapons within 2 cells of the hit for 1.5 s. Weak against hull. Covers 46° either side of its facing.'},
  tesla:  {name:'Tesla coil', key:'z', unlock:5, rar:3, cost:120, hp:22, mass:2, tesla:{cd:.9, range:110, dmg:14, jumps:3, en:6}, desc:'Arcs lightning to the nearest enemy block within 11 m, then jumps to 2 more blocks close by. Reaches in every direction, through your own hull, and zaps enemy fighters and missiles too.'},
  torpedo:{name:'Torpedo', key:'o', unlock:1, rar:3, cost:140, hp:22, mass:1.5, rot:true, gun:{range:1000, cd:5, en:22, spd:150, dmg:70, spread:.01, r:3.4, arc:.35, fx:'torp', nofall:true}, desc:'2 blocks long. Slow, unguided heavy torpedo fired along its facing (20° either side to aim): 70 damage and a wide blast. Point defense cannot stop it.'},
  mine:   {name:'Mine layer', key:'n', unlock:2, rar:1, cost:60, hp:18, mass:1.5, gun:{range:320, cd:2.4, en:5, spd:70, dmg:20, spread:.5, r:2.4, arc:Math.PI, fx:'mine', life:20, fuse:24, blast:34, lob:true}, desc:'Drops proximity mines that drift to a stop and wait up to 20 s, bursting when an enemy comes near. Launched over your own hull in any direction.'},
  laser:  {name:'Laser', key:'6', unlock:3, rar:2, cost:110, hp:24, mass:1.5, rot:true, laser:{dps:70, range:150, en:10}, desc:'2 blocks long. Continuous beam along its facing, swinging 5° to aim. Short range, and hits hardest up close.'},
  rail:   {name:'Railgun', key:'7', unlock:6, rar:3, cost:150, hp:28, mass:2, rot:true, rail:{cd:4, pool:65, en:49.5, range:1100}, desc:'3 blocks long. Fires along its facing and pierces block after block. Swings 5° to aim; line up the ship to shoot.'},
  engine: {name:'Engine', key:'8', unlock:1, rar:0, cost:16, hp:14, mass:1, rot:true, thrust:6, desc:'Pushes toward its facing. Exhaust needs an open cell behind it.'},
  gyro:   {name:'Gyro', key:'9', unlock:1, rar:0, cost:30, hp:18, mass:1.5, torque:25, desc:'Turns the ship faster. Blocks far from the core make turning slower.'},
  shield: {name:'Shield', key:'0', unlock:1, rar:1, cost:60, hp:18, mass:1.5, sh:{hp:45, regen:10, delay:3.5, down:7, en:.6}, desc:'Projects a bubble that stops shots from any side, covering blocks up to 2 cells away (+1 per level). Stops 45 damage, then pops for 7 s.'},
  pd:     {name:'Point defense', key:'q', unlock:2, rar:1, cost:40, hp:16, mass:1.5, pd:{cd:.45, range:85, en:2}, desc:'Shoots down enemy missiles, flak and gatling rounds that come close. Cannon slugs, rail rounds and capital-ship orbs are too heavy to stop.'},
  aegis:  {name:'Aegis array', key:'y', unlock:5, rar:3, cost:230, hp:60, mass:6, pd:{cd:.16, range:210, en:3, heavy:true}, desc:'4×4 point defense battery. Reaches two and a half times as far as point defense and fires three times as fast, and its heavy guns stop cannon slugs as well as missiles, flak and gatling rounds.'},
  gen:    {name:'Generator', key:'g', unlock:1, rar:0, cost:25, hp:14, mass:2, en:{regen:8}, desc:'Makes 8 energy per second. Weapons and shields run on energy. Safe deep inside the hull.'},
  battery:{name:'Battery', key:'b', unlock:1, rar:0, cost:15, hp:12, mass:1.5, en:{cap:60}, desc:'Stores 60 energy for bursts of fire. Safe deep inside the hull.'},
  fbay:   {name:'Fighter bay', key:'h', unlock:4, rar:2, cost:95, hp:20, mass:1.5, rot:true, desc:'1×4 hangar. Launches a fighter out of its front end that dogfights nearby enemies. Every 30 s it docks to rearm and repair, then flies out again. A lost fighter takes 15 s to replace.'},
  bbay:   {name:'Bomber bay', key:'j', unlock:7, rar:4, cost:240, hp:24, mass:2, rot:true, desc:'2×6 hangar. Launches a slow, tough bomber that passes over enemy hulls dropping heavy area bombs. Every 30 s it docks to rearm and repair, then flies out again. A lost bomber takes 25 s to replace.'},
  sell:   {name:'Remove', key:'x', cost:0, desc:'Take a block off the ship and back into cargo (plating is refunded). Damaged blocks are scrapped. Right-click does the same.'},
  rail_b: {name:'Railgun', cost:0, hp:28, mass:2, rot:true},
  laser_b:{name:'Laser', cost:0, hp:24, mass:1.5, rot:true},
  fbay_b: {name:'Fighter bay', cost:0, hp:20, mass:1.5, rot:true},
  bbay_b: {name:'Bomber bay', cost:0, hp:24, mass:2, rot:true},
  bigcannon_b:{name:'Big cannon', cost:0, hp:30, mass:2.5, rot:true},
  hgatling_b:{name:'Heavy gatling', cost:0, hp:22, mass:2, rot:true},
  mirv_b: {name:'MIRV', cost:0, hp:18, mass:2.5},
  torpedo_b:{name:'Torpedo', cost:0, hp:22, mass:1.5, rot:true},
  aegis_b:{name:'Aegis array', cost:0, hp:40, mass:2},
} satisfies Record<string, BlockDef>;
export const T: Record<BlockType, BlockDef> = BLOCKS;
/** The catalogue entry for a cell, if the player can build it (enemy-only cells such as carrier bays have none). */
export const def = (t: Cell): BlockDef | undefined => T[t as BlockType];
// multi-cell parts: len cells trailing behind the head along its facing, w columns wide extending to the head's starboard,
// or an explicit shape: cells as [cells behind the head, cells to its starboard]
export const PARTS: Partial<Record<Cell, PartDef>> = {bigcannon:{len:3, cells:[[1,0],[2,0],[2,-1],[2,1]], body:'bigcannon_b'}, hgatling:{len:2, body:'hgatling_b'}, rail:{len:3, body:'rail_b'}, laser:{len:2, body:'laser_b'}, fbay:{len:4, body:'fbay_b'}, bbay:{len:6, w:2, body:'bbay_b'}, mirv:{len:2, w:2, body:'mirv_b'}, torpedo:{len:2, body:'torpedo_b'}, aegis:{len:4, w:4, body:'aegis_b'}};
export const HEAD_OF: Partial<Record<Cell, BlockType>> = {bigcannon_b:'bigcannon', hgatling_b:'hgatling', rail_b:'rail', laser_b:'laser', fbay_b:'fbay', bbay_b:'bbay', mirv_b:'mirv', torpedo_b:'torpedo', aegis_b:'aegis'};
/** Every cell of a part as [behind, starboard] from its head, the head first. */
export const partOffsets = (P: PartDef): [number, number][] => {
  if (P.cells) return [[0,0], ...P.cells];
  const out: [number, number][] = [];
  for (let m=0; m<(P.w||1); m++) for (let n=0; n<P.len; n++) out.push([n,m]);
  return out;
};
export const isPart = (t: Cell | undefined) => !!(t && (PARTS[t] || HEAD_OF[t]));
export const BEAM = (t: Cell) => t==='rail' || t==='laser';
// Hangar craft flown out of the bays. hp scales the craft's blocks; it circles its target at target radius*over + orbit.
export const CRAFT = {
  fbay:{design:[[0,0,'core'],[0,-1,'gatling'],[-1,0,'hull'],[1,0,'hull'],[0,1,'engine']], hp:.28, spd:320, agi:3, turn:6, orbit:60, over:1, orbSpd:1.1, range:220, sortie:30, rearm:3, rebuild:15, sfx:'gatling',
    gun:{cd:.35, spd:720, dmg:5.2, spread:.05, r:1.6, fx:'line'}},
  bbay:{design:[[0,0,'core'],[0,-1,'armor'],[-1,0,'armor'],[1,0,'armor'],[-2,0,'hull'],[2,0,'hull'],[-1,1,'engine'],[1,1,'engine'],[0,1,'hull']], hp:.45, spd:170, agi:1.4, turn:2.2, orbit:10, over:.5, orbSpd:.5, range:60, sortie:30, rearm:3, rebuild:25, sfx:'cannon',
    gun:{cd:1.6, spd:200, dmg:30, spread:.05, r:3, fx:'flak', life:2, fuse:6, blast:32}},
} satisfies Record<string, CraftDef>;
/** Is this cell a hangar that launches craft? */
export const isCraft = (t: Cell): t is CraftKind => t in CRAFT;
export const ET = {core:{hp:45}, engine:{hp:12}, hull:{hp:18}, armor:{hp:55}, cannon:{hp:15}, gatling:{hp:13}, missile:{hp:14}, flak:{hp:15}, rail:{hp:20}, shield:{hp:14}, gen:{hp:10}, bay:{hp:30}, pd:{hp:12}} satisfies Record<string, {hp:number}>;
// Enemy turrets: the player's weapons, slowed down to enemy scale. They unlock on the same stages as the player's.
// cd is per gun; gatlings fire bursts of `burst` shots `gap` apart; rails show a sight line for the last `aim` seconds.
// Enemy rounds are fast enough that a ship can't simply outrun them; dodging means changing direction as they come.
export const EW = {
  cannon: {unlock:1, w:3, range:480, cd:3.8, spd:290, dmg:14, r:1.5, kind:'eoval', spread:.04},
  gatling:{unlock:2, w:3, range:320, cd:3.2, burst:3, gap:.12, spd:400, dmg:5, r:.8, kind:'egat', spread:.07},
  missile:{unlock:3, w:1.5, range:1000, cd:8, spd:112, dmg:22, r:1.2, kind:'emiss', spread:.5},
  flak:   {unlock:4, w:2, range:560, cd:4.4, spd:240, dmg:10, r:1, kind:'eflak', spread:.1, fuse:16, blast:26, life:4},
  rail:   {unlock:7, w:1, range:1100, cd:6.5, spd:460, dmg:36, r:1.5, kind:'snipe', aim:.9},
} satisfies Record<string, EnemyGunDef>;
/** An enemy turret's stats, if the cell is one. */
export const ewOf = (t: Cell): EnemyGunDef | undefined => (EW as Record<string, EnemyGunDef>)[t];
export function pickWeapon(stage: number): EnemyGun {
  const ks = (Object.keys(EW) as EnemyGun[]).filter(k => EW[k].unlock <= stage);
  let r = Math.random()*ks.reduce((a,k) => a + EW[k].w, 0);
  for (const k of ks) if ((r -= EW[k].w) < 0) return k;
  return ks[0];
}
export const ESH = {hp:30, regen:12, delay:3, down:6, rad:2.5*10}; // enemy shield bubble
export const PAL: BlockType[] = ['hull','armor','cannon','bigcannon','gatling','hgatling','scatter','flak','ion','missile','mirv','mine','torpedo','laser','rail','tesla','fbay','bbay','engine','gyro','shield','pd','aegis','gen','battery','sell'];
export const COL: Record<'p'|'e'|'a', Partial<Record<Cell, string>>> = {
  p:{core:'#ffffff', hull:'#bcd0f5', armor:'#86a6e6', cannon:'#a8ecff', bigcannon:'#a8ecff', bigcannon_b:'#7fb0d0', gatling:'#a8ecff', hgatling:'#a8ecff', hgatling_b:'#7fb0d0', missile:'#ffe08a', engine:'#ffb27a', pd:'#c9adff', mirv:'#ff9ad0', mirv_b:'#c070a0', gyro:'#8ff0c8',
     laser:'#9dff8a', laser_b:'#72d86a', rail:'#efe6ff', rail_b:'#b9a8f0', shield:'#5fd3ff', gen:'#ffd04a', battery:'#7fe07a',
     fbay:'#a8ecff', fbay_b:'#7fb0d0', bbay:'#ffc46b', bbay_b:'#c09050', scatter:'#a8ecff', ion:'#7fd8ff', tesla:'#c8b0ff', torpedo:'#ffe08a', torpedo_b:'#c0a050', aegis:'#c9adff', aegis_b:'#8a70c0', mine:'#ffb27a'},
  e:{core:'#ffd6cc', hull:'#ff7a66', armor:'#d0504a', cannon:'#ffc46b', gatling:'#ffc46b', missile:'#ffc46b', flak:'#ffc46b', rail:'#ffc46b', shield:'#5fd3ff', gen:'#ffd04a', bay:'#9a4630', pd:'#c9adff', engine:'#ff9a6a'},
  a:{},
}; // hangar craft
export const BCOL: Record<string, string> = {pellet:'#fff0a0', ion:'#a070ff', torp:'#ffd04a', mine:'#ff7a3a', shot:'#ffe84a', oval:'#5fd8ff', line:'#7ff6ff', miss:'#ffe08a', mirv:'#ff7ad8', flak:'#ff9a3a', aim:'#ff8a2a', ring:'#ff4ad0', snipe:'#ff2a2a', eoval:'#ff8a2a', egat:'#ff6a3a', eflak:'#ffb03a', emiss:'#ff5a3a'};
// Hull and armor are plating: bought with credits in drydock. Every other block comes out of cargo.
export const PLATE = (t: Cell) => t==='hull' || t==='armor';
export const onShip = (t: BlockType) => { for (const v of G.design.values()) if (v===t) return true; return false; };
export const owned = (t: BlockType) => t==='sell' || PLATE(t) || (G.inv[t]||0) > 0 || onShip(t) || (G.outfit && unlocked(t));
// Outfitting: before the first jump of a run, any unlocked block can be bought straight onto the ship with the starting budget.
export const outfitPrice = (t: BlockType) => Math.round(T[t].cost*priceMul());
export const canBuyHere = (t: BlockType) => G.outfit && !PLATE(t) && unlocked(t);
// sectors map onto the old stage tiers: which blocks drop and which weapons enemies carry
export const tierOf = (s: number) => Math.floor(s*1.5 + 1);
// block levels: bought per type at shops, +35% to the block's main stat per level up to Lv5, then +20% per level up to Lv10
export const MAXLV = 10;
const lvMul = (L: number) => L <= 5 ? 1 + .35*(L-1) : 2.4 + .2*(L-5);
/** What the next level adds to a block's main stat, in percent. */
export const lvStep = (L: number) => Math.round((lvMul(L+1)/lvMul(L) - 1)*100);
// Rarity: rare blocks drop less often, but anything already unlocked can turn up from sector 1 on (see rollBlock).
export const RARITY = [{name:'Common', col:'#bcd0f5'}, {name:'Uncommon', col:'#7fe07a'}, {name:'Rare', col:'#5fb8ff'}, {name:'Epic', col:'#c88aff'}, {name:'Legendary', col:'#ffb03a'}];
export const rarOf = (t: BlockType) => T[t].rar || 0;
/** A block's name, coloured by its rarity. */
export const rarName = (t: BlockType) => `<b style="color:${RARITY[rarOf(t)].col}">${T[t].name}</b>`;
// Blocks unlock for good the first time a run reaches their sector; G.meta.best is the furthest sector ever reached.
export const unlocked = (t: BlockType) => (T[t].unlock || 1) <= (G.meta.best || 1);
// Hangar upgrades bought with data: permanent boosts to the player's ships (craft included).
export const HM = {
  hp:  () => 1 + .05*metaLv('plating'),
  dmg: () => 1 + .04*metaLv('guns'),
  en:  () => 1 + .06*metaLv('power'),
  drive: () => 1 + .05*metaLv('drive'),
  sh:  () => 1 + .08*metaLv('shields'),
};
// Weapon groups, Starsector style: every weapon on the ship (keyed by its head cell) sits in one of five groups, starting in its type's default;
// a group on auto fires on its own at the nearest hostile.
export const WGRP: Partial<Record<Cell, number>> = {cannon:1, bigcannon:1, gatling:1, hgatling:1, scatter:1, flak:1, ion:1, laser:1, missile:2, mirv:2, rail:3, torpedo:3, mine:4, tesla:4};
export const GCOL = ['#5fd8ff','#ffc46b','#ff7ad8','#9dff8a','#ff9a7a'];
export const isWeapon = (t: Cell | undefined) => !!t && !!WGRP[t];
export const grpOf = (k: Key, t: Cell) => G.grp[k] || WGRP[t] || 1;
// a part's body cells share the level of its head
export const lvOf = (t: Cell) => G.lv[(HEAD_OF[t] || t) as BlockType] || 1;
export const LV = (t: Cell) => lvMul(lvOf(t));
export const priceMul = () => (1 + .08*(G.stage-1))*(1 - .07*metaLv('trade'));
export const upCost = (t: BlockType) => Math.round(Math.max(30, T[t].cost*3)*lvOf(t)*priceMul());
// fixing one destroyed cell; multi-cell parts spread their price over their cells
export const repCost = (t: BlockType) => { const h = HEAD_OF[t] || t, P = PARTS[h]; return Math.max(1, Math.ceil(T[h].cost*.3/(P ? partOffsets(P).length : 1))); };
// shield bubble radius: covers blocks up to 1 + level cells away (2 at Lv1, 4 at Lv3)
export const shRad = () => (1 + Math.min(4, lvOf('shield')) + .5)*BS;

// wiring that runs once at start-up
export function init(){
  COL.a = COL.p; // hangar craft wear the player's colours
}
