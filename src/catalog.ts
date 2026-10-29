import { BS } from './grid';
import { metaLv } from './runs';
import { G, blockCount } from './state';
import type { BlockDef, BlockType, Cell, CraftDef, CraftKind, EnemyCell, EnemyGun, EnemyGunDef, Facing, GunDef, Key, PartDef } from './types';

// ---------- block catalogue ----------
// BLOCKS keeps its literal keys (they become the BlockType union); T is the same table read as BlockDefs.
export const BLOCKS = {
  core:   {name:'Core', cost:0, hp:80, mass:3, thrust:4, torque:12, gun:{range:220, cd:.35, spd:600, dmg:4, spread:.03, r:2, arc:Math.PI, over:true}, desc:'Your heart. Lose it, or all of the ship’s life, and the run is over. Gives a little thrust in every direction.'},
  cockpit:{name:'Cockpit', cost:0, hp:45, mass:1.2, desc:'Part of the cockpit. It goes wherever the cockpit goes.'},
  hull:   {name:'Hull', key:'1', unlock:1, rar:0, cost:2, hp:22, mass:1, desc:'Cheap structure that holds everything together.'},
  hullc:  {name:'Hull corner', key:'l', unlock:1, rar:0, cost:2, hp:16, mass:.7, rot:true, desc:'Hull with one corner cut away at 45°, for angled edges and noses. R turns it.'},
  armorc: {name:'Armor corner', key:'t', unlock:1, rar:0, cost:8, hp:52, mass:2.2, rot:true, desc:'Armor with one corner cut away at 45°. Takes 30% less damage, like armor. R turns it.'},
  armor:  {name:'Armor', key:'2', unlock:1, rar:0, cost:10, hp:70, mass:3, desc:'Three times the toughness of hull, and takes 30% less damage. Heavy.'},
  cannon: {name:'KM-3 Cannon', make:'Kessler Arms', key:'3', unlock:1, rar:0, cost:33, hp:20, mass:1.5, rot:true, gun:{range:324, cd:.54, en:3, spd:480, dmg:9, spread:.02, r:2.8, arc:.9, fx:'oval'}, desc:'Turret. Heavy slugs that splash and shove, 17 damage per second. Covers 52° either side of its facing.'},
  bigcannon:{name:'Goliath Cannon', make:'Teller Heavy Industries', key:'k', unlock:4, rar:2, cost:120, hp:30, mass:3, rot:true, gun:{range:552, cd:1.69, en:12, spd:400, dmg:42, spread:.015, r:4.2, arc:.7, fx:'slug'}, desc:'Inverted T: a 3-wide base with a 2-cell nose ahead of it. Turret firing huge slugs, about 25 damage per second, from the tip of its nose. Each one hits like a ram: a wide blast that cracks blocks two cells out, a hard shove, and a kick back on your own ship. Covers 40° either side of its facing.'},
  hgatling:{name:'Maelstrom Gatling', make:'Teller Heavy Industries', key:'u', unlock:3, rar:2, cost:95, hp:22, mass:2.5, rot:true, gun:{range:280, cd:.1, en:1.1, spd:700, dmg:3.8, spread:.035, r:2, arc:1.05, fx:'line'}, desc:'2 blocks long. Turret with a hammering tracer stream, 38 damage per second. Covers 60° either side of its facing.'},
  gatling:{name:'Hailstorm Gatling', make:'Kessler Arms', key:'4', unlock:2, rar:0, cost:51, hp:16, mass:1.5, rot:true, gun:{range:273, cd:.15, en:1, spd:760, dmg:3.6, spread:.03, r:1.8, arc:1.25, fx:'line', over:true}, desc:'Turret. Tight tracer stream, 24 damage per second, fired over your own hull. Covers 72° either side of its facing.'},
  missile:{name:'Viper Missile', make:'Orion Dynamics', key:'5', unlock:2, rar:1, cost:86, hp:16, mass:2, gun:{range:1100, cd:4.1, en:8, spd:172, dmg:18, spread:.6, r:3.2, homing:true, arc:Math.PI}, desc:'Slow warheads that home for 4 s, then fly straight and blow up in a wide blast. Launch in any direction and fly over your own hull.'},
  mirv:   {name:'Hydra MIRV', make:'Orion Dynamics', key:'v', unlock:6, rar:3, cost:120, hp:18, mass:2.5, gun:{range:1000, cd:6, en:22, spd:142, dmg:9, spread:.4, r:3.6, homing:true, arc:Math.PI, mirv:9}, desc:'2×2 launcher. A slow carrier missile that splits into 9 homing warheads shortly after launch (sooner near a target), fanning out wide, each with its own blast. Enemy point defense can shoot them down.'},
  plasma: {name:'Helios Plasma Cannon', make:'Teller Heavy Industries', key:'p', unlock:9, rar:3, cost:210, hp:30, mass:3, rot:true, gun:{range:700, cd:2.93, en:16, spd:225, dmg:34, spread:.02, r:4, arc:.8, fx:'plasma', fuse:26, blast:52, nofall:true}, desc:'Turret. A slow plasma bolt that bursts beside a hull in a huge blast, about 12 damage per second before the splash. Covers 46° either side of its facing.'},
  swarm:  {name:'Swarm Pod', make:'Orion Dynamics', key:'e', unlock:11, rar:4, cost:300, hp:22, mass:2, gun:{range:900, cd:3.6, en:14, spd:351, dmg:3.5, spread:.3, r:1, homing:true, arc:Math.PI, pellets:12, fan:Math.PI*2*11/12, weave:true}, desc:'2×3 pod. Unleashes a storm of twelve micro-missiles that burst out in every direction, then loop and corkscrew in on long white smoke trails. Launch in any direction and fly over your own hull.'},
  flak:   {name:'Bloom Flak', make:'Ashgrove Defense', key:'f', unlock:2, rar:1, cost:45, hp:18, mass:1.5, rot:true, gun:{range:460, cd:.8, en:4, spd:420, dmg:7, spread:.08, r:2.2, arc:1.1, fx:'flak', fuse:22, blast:26, nofall:true}, desc:'Turret. Shells burst near enemy ships, damaging every block in the blast and wiping out enemy bullets. Covers 63° either side of its facing.'},
  scatter:{name:'Shrike Scattergun', make:'Ruiz Ordnance', key:'c', unlock:1, rar:0, cost:40, hp:18, mass:1.5, rot:true, gun:{range:213, cd:1.1, en:4, spd:520, dmg:2.9, spread:.04, r:1.6, arc:1, fx:'pellet', pellets:7, fan:.32, over:true}, desc:'Turret. Blasts 7 pellets in a wide cone over your own hull: about 18 damage per second up close, nothing at range. Covers 57° either side of its facing.'},
  ion:    {name:'VH-9 Ion Lance', make:'Varga-Holt', key:'i', unlock:3, rar:2, cost:85, hp:18, mass:1.5, rot:true, gun:{range:380, cd:1.4, en:9, spd:420, dmg:6, spread:.03, r:2.6, arc:.8, fx:'ion', ion:true}, desc:'Turret. Ion bolts do 5× damage to shield bubbles and jam the enemy weapons within 2 cells of the hit for 1.5 s. Weak against hull. Covers 46° either side of its facing.'},
  goo:    {name:'Mire Goo Sprayer', make:'Ruiz Ordnance', key:'s', unlock:2, rar:1, cost:55, hp:18, mass:1.5, rot:true, gun:{range:250, cd:.9, en:3, spd:300, dmg:1.2, spread:.05, r:1.8, arc:1, fx:'goo', pellets:5, fan:.45, over:true, stick:'goo'}, desc:'Turret. Sprays sticky goo over your own hull that clings to enemy ships for 5 s: each blob slows their flying and turning by 5%, down to under half speed. Barely scratches the paint. Covers 57° either side of its facing.'},
  hack:   {name:'Wraith Hacking Module', make:'Varga-Holt', key:'a', unlock:4, rar:2, cost:110, hp:18, mass:1.5, rot:true, gun:{range:1000, cd:12, en:10, spd:150, dmg:4, spread:.01, r:2.4, arc:1, fx:'hack', stick:'hack', nofall:true}, desc:'Turret. Fires a slow, long-range module that drifts after its target and clamps onto the hull for 10 s, hacking it: 15% slower flying, 25% slower reloads and 30% less from its generators, stacking up to 3. Reloads very slowly. Covers 57° either side of its facing.'},
  tesla:  {name:'Stormcoil', make:'Helix Works', key:'z', unlock:5, rar:3, cost:120, hp:22, mass:2, tesla:{cd:.9, range:110, dmg:14, jumps:3, en:6}, desc:'Arcs lightning to the nearest enemy block within 11 m, then jumps to 2 more blocks close by. Reaches in every direction, through your own hull, and zaps enemy fighters and missiles too.'},
  torpedo:{name:'Leviathan Torpedo', make:'Teller Heavy Industries', key:'o', unlock:4, rar:3, cost:140, hp:22, mass:1.5, rot:true, gun:{range:1000, cd:5, en:22, spd:175, dmg:70, spread:.01, r:3.4, arc:.35, fx:'torp', nofall:true}, desc:'2 blocks long. Slow, unguided heavy torpedo fired along its facing (20° either side to aim): 70 damage and a wide blast. Point defense cannot stop it.'},
  mine:   {name:'Tangle Mine Layer', make:'Ashgrove Defense', key:'n', unlock:2, rar:1, cost:60, hp:18, mass:1.5, gun:{range:320, cd:2.4, en:5, spd:70, dmg:20, spread:.5, r:2.4, arc:Math.PI, fx:'mine', life:20, fuse:24, blast:34, lob:true}, desc:'Drops proximity mines that drift to a stop and wait up to 20 s, bursting when an enemy comes near. Launched over your own hull in any direction.'},
  laser:  {name:'Sunspear Laser', make:'Lumen Industries', key:'6', unlock:3, rar:2, cost:110, hp:24, mass:1.5, rot:true, laser:{dps:88.5, range:350, en:12}, desc:'2 blocks long. Continuous beam along its facing, swinging 5° to aim. Hits hardest up close and fades toward the end of its reach.'},
  glimmer:{name:'Glimmer Beam', make:'Lumen Industries', key:'w', unlock:3, rar:1, cost:70, hp:16, mass:1.2, rot:true, laser:{dps:22, range:520, en:12, arc:1.1, fall:.85}, desc:'Turret. A pale green beam that reaches far but burns weakly, losing most of its bite toward the end of its range, and eats a lot of energy for what it does. Good for wearing down a target alongside your main guns. Covers 63° either side of its facing.'},
  rail:   {name:'Longbow Railgun', make:'Nakamura Kinetics', key:'7', unlock:6, rar:3, cost:150, hp:28, mass:2, rot:true, rail:{cd:4, pool:65, en:49.5, range:1100}, desc:'3 blocks long. Charges for half a second, then fires a fast slug along its facing that pierces block after block and loses up to 30% of its punch near the end of its range. Swings 5° to aim; line up the ship to shoot.'},
  engine: {name:'Engine', key:'8', unlock:1, rar:0, cost:16, hp:14, mass:1, rot:true, thrust:6, desc:'Pushes toward its facing. Exhaust needs an open cell behind it.'},
  gyro:   {name:'Gyro', key:'9', unlock:1, rar:0, cost:30, hp:18, mass:1.5, torque:25, desc:'Turns the ship faster. Blocks far from the core make turning slower.'},
  shield: {name:'Shield', key:'0', unlock:3, rar:1, cost:60, hp:18, mass:1.5, sh:{hp:45, regen:10, delay:3.5, down:7, en:.6}, desc:'Projects a bubble that stops shots from any side, covering blocks up to 2 cells away (+1 per level). Stops 45 damage, then pops for 7 s.'},
  pd:     {name:'Picket Point Defense', make:'Ashgrove Defense', key:'q', unlock:2, rar:1, cost:40, hp:16, mass:1.5, pd:{cd:.45, range:85, en:2}, desc:'Shoots down enemy missiles, flak and gatling rounds that come close. Cannon slugs, rail rounds and capital-ship orbs are too heavy to stop.'},
  aegis:  {name:'Aegis Array', make:'Ashgrove Defense', key:'y', unlock:5, rar:3, cost:230, hp:60, mass:6, pd:{cd:.16, range:210, en:3, heavy:true}, desc:'2×3 point defense battery. Reaches two and a half times as far as point defense and fires three times as fast, and its heavy guns stop cannon slugs as well as missiles, flak and gatling rounds.'},
  gen:    {name:'Generator', key:'g', unlock:1, rar:0, cost:25, hp:14, mass:2, en:{regen:8}, desc:'Makes 8 energy per second. Weapons and shields run on energy. Safe deep inside the hull.'},
  battery:{name:'Battery', key:'b', unlock:1, rar:0, cost:15, hp:12, mass:1.5, en:{cap:60}, desc:'Stores 60 energy for bursts of fire. Safe deep inside the hull.'},
  fbay:   {name:'Wasp Fighter Bay', make:'Orion Dynamics', key:'h', unlock:4, rar:2, cost:95, hp:20, mass:1.5, rot:true, desc:'1×4 hangar. Launches a fighter out of its front end that dogfights nearby enemies. Every 30 s it docks to rearm and repair, then flies out again. A lost fighter takes 15 s to replace.'},
  bbay:   {name:'Albatross Bomber Bay', make:'Orion Dynamics', key:'j', unlock:7, rar:4, cost:240, hp:24, mass:2, rot:true, desc:'2×6 hangar. Launches a slow, tough bomber that passes over enemy hulls dropping heavy area bombs. Every 30 s it docks to rearm and repair, then flies out again. A lost bomber takes 25 s to replace.'},
  sell:   {name:'Remove', key:'x', cost:0, desc:'Take a block off the ship and back into cargo (plating is refunded). Damaged blocks are scrapped. Right-click does the same.'},
  rail_b: {name:'Longbow Railgun', cost:0, hp:28, mass:2, rot:true},
  laser_b:{name:'Sunspear Laser', cost:0, hp:24, mass:1.5, rot:true},
  fbay_b: {name:'Wasp Fighter Bay', cost:0, hp:20, mass:1.5, rot:true},
  bbay_b: {name:'Albatross Bomber Bay', cost:0, hp:24, mass:2, rot:true},
  bigcannon_b:{name:'Goliath Cannon', cost:0, hp:30, mass:2.5, rot:true},
  hgatling_b:{name:'Maelstrom Gatling', cost:0, hp:22, mass:2, rot:true},
  mirv_b: {name:'Hydra MIRV', cost:0, hp:18, mass:2.5},
  torpedo_b:{name:'Leviathan Torpedo', cost:0, hp:22, mass:1.5, rot:true},
  aegis_b:{name:'Aegis Array', cost:0, hp:40, mass:2},
  swarm_b:{name:'Swarm Pod', cost:0, hp:20, mass:1.5},
} satisfies Record<string, BlockDef>;
export const T: Record<BlockType, BlockDef> = BLOCKS;
/** The catalogue entry for a cell, if the player can build it (enemy-only cells such as carrier bays have none). */
export const def = (t: Cell): BlockDef | undefined => T[t as BlockType];
// multi-cell parts: len cells trailing behind the head along its facing, w columns wide extending to the head's starboard,
// or an explicit shape: cells as [cells behind the head, cells to its starboard]
export const PARTS: Partial<Record<Cell, PartDef>> = {bigcannon:{len:3, cells:[[1,0],[2,0],[2,-1],[2,1]], body:'bigcannon_b'}, hgatling:{len:2, body:'hgatling_b'}, rail:{len:3, body:'rail_b'}, laser:{len:2, body:'laser_b'}, fbay:{len:4, body:'fbay_b'}, bbay:{len:6, w:2, body:'bbay_b'}, mirv:{len:2, w:2, body:'mirv_b'}, torpedo:{len:2, body:'torpedo_b'}, aegis:{len:3, w:2, body:'aegis_b'}, swarm:{len:3, w:2, body:'swarm_b'}};
export const HEAD_OF: Partial<Record<Cell, BlockType>> = {cockpit:'core', bigcannon_b:'bigcannon', hgatling_b:'hgatling', rail_b:'rail', laser_b:'laser', fbay_b:'fbay', bbay_b:'bbay', mirv_b:'mirv', torpedo_b:'torpedo', aegis_b:'aegis', swarm_b:'swarm'};
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
  // a fighter is a single block: small to hit, with its hit points scaled up to match the old five-block airframe
  fbay:{design:[[0,0,'core']], hp:.54, spd:320, agi:3, turn:6, orbit:60, over:1, orbSpd:1.1, range:220, sortie:30, rearm:3, rebuild:15, sfx:'gatling',
    gun:{cd:.35, spd:720, dmg:5.2, spread:.05, r:1.6, fx:'line'}},
  // a bomber is a single block too, a little wider on screen, as tough as the old nine-block airframe
  bbay:{design:[[0,0,'core']], hp:2.16, spd:170, agi:1.4, turn:2.2, orbit:10, over:.5, orbSpd:.5, range:60, sortie:30, rearm:3, rebuild:25, sfx:'cannon',
    gun:{cd:1.6, spd:200, dmg:30, spread:.05, r:3, fx:'flak', life:2, fuse:6, blast:32}},
} satisfies Record<string, CraftDef>;
/** Is this cell a hangar that launches craft? */
export const isCraft = (t: Cell): t is CraftKind => t in CRAFT;
// structure is as tough as the player's own blocks (hull 22, armour 70); weapons and systems a little lighter
export const ET = {plasma:{hp:22}, swarm:{hp:18}, bigcannon:{hp:20}, hgatling:{hp:15}, scatter:{hp:13}, ion:{hp:13}, goo:{hp:13}, hack:{hp:13}, mirv:{hp:15}, laser:{hp:16}, glimmer:{hp:12}, tesla:{hp:15}, gyro:{hp:18}, core:{hp:45}, engine:{hp:14}, hull:{hp:22}, armor:{hp:70}, cannon:{hp:15}, gatling:{hp:13}, missile:{hp:14}, flak:{hp:15}, rail:{hp:20}, shield:{hp:14}, gen:{hp:10}, bay:{hp:30}, pd:{hp:12}} satisfies Record<string, {hp:number}>;
// Enemy weapons: the player's, slowed down to enemy scale (all but torpedoes and mines, which need a pilot's timing).
// Enemies carry one from the sector that unlocks it for the player, see enemyFrom.
// cd is per gun; gatlings fire bursts of `burst` shots `gap` apart; rails show a sight line for the last `aim` seconds;
// pellets fan out over `fan`; split carriers break into homing warheads; beams burn for `beam.dur` seconds; zaps arc to blocks.
// arc and over stand in for the player weapon's own firing arc and over-the-hull rule where the enemy's differs.
// Enemy rounds are fast enough that a ship can't simply outrun them; dodging means changing direction as they come.
export const EW = {
  cannon:   {w:3, range:480, cd:3.8, spd:290, dmg:14, r:1.5, kind:'eoval', spread:.04},
  scatter:  {w:2, range:250, cd:4, spd:300, dmg:4, r:.7, kind:'egat', spread:.03, pellets:6, fan:.4},
  gatling:  {w:3, range:320, cd:3.2, burst:3, gap:.12, spd:400, dmg:5, r:.8, kind:'egat', spread:.07},
  hgatling: {w:1.5, range:300, cd:3.6, burst:6, gap:.09, spd:420, dmg:5, r:.8, kind:'egat', spread:.09},
  bigcannon:{w:1, range:640, cd:8, spd:240, dmg:60, r:2.6, kind:'eoval', spread:.02},
  missile:  {w:1.5, range:1000, cd:8, spd:95, dmg:22, r:1.2, kind:'emiss', spread:.5},
  mirv:     {w:1, range:900, cd:10, spd:85, dmg:12, r:1.4, kind:'emiss', spread:.3, split:3},
  flak:     {w:2, range:560, cd:4.4, spd:240, dmg:10, r:1, kind:'eflak', spread:.1, fuse:16, blast:26, life:4},
  ion:      {w:1.2, range:440, cd:5, spd:260, dmg:6, r:1.2, kind:'ion', spread:.03, ion:true},
  goo:      {w:1.5, range:260, cd:4.5, spd:240, dmg:1.5, r:1, kind:'egoo', spread:.05, pellets:5, fan:.5, stick:'goo'},
  hack:     {w:.8, range:800, cd:14, spd:130, dmg:5, r:1.2, kind:'ehack', spread:.02, stick:'hack'},
  laser:    {w:1.2, range:360, cd:6, spd:0, dmg:0, r:0, kind:'line', arc:.5, beam:{dur:1.4, dps:30}},
  glimmer:  {w:1.2, range:520, cd:4, spd:0, dmg:0, r:0, kind:'line', beam:{dur:2, dps:9, fall:.85}},
  tesla:    {w:1, range:160, cd:3, spd:0, dmg:12, r:0, kind:'line', arc:Math.PI, over:true, zap:3},
  rail:     {w:1, range:1100, cd:6.5, spd:460, dmg:36, r:1.5, kind:'snipe', aim:.9},
  plasma:   {w:1.4, range:560, cd:7.3, spd:172, dmg:30, r:2.2, kind:'eflak', spread:.05, fuse:22, blast:44, life:5.3},
  swarm:    {w:1.2, range:1000, cd:7, burst:5, gap:.12, spd:100, dmg:9, r:1, kind:'emiss', spread:.6},
} satisfies Record<string, EnemyGunDef>;
/** An enemy turret's stats, if the cell is one. */
export const ewOf = (t: Cell): EnemyGunDef | undefined => (EW as Record<string, EnemyGunDef>)[t];
/** The first sector whose enemies carry weapon k: the one that unlocks it for the player. */
export const enemyFrom = (k: EnemyGun) => T[k].unlock || 1;
/** A weapon for an enemy built in sector `sector`, weighted toward the common ones. */
export function pickWeapon(sector: number): EnemyGun {
  const ks = (Object.keys(EW) as EnemyGun[]).filter(k => enemyFrom(k) <= sector);
  let r = Math.random()*ks.reduce((a,k) => a + EW[k].w, 0);
  for (const k of ks) if ((r -= EW[k].w) < 0) return k;
  return ks[0];
}
export const ESH = {hp:30, regen:12, delay:3, down:6, rad:2.5*10}; // enemy shield bubble
export const PAL: BlockType[] = ['hull','armor','hullc','armorc','cannon','bigcannon','gatling','hgatling','scatter','flak','plasma','ion','goo','hack','missile','mirv','swarm','mine','torpedo','laser','glimmer','rail','tesla','fbay','bbay','engine','gyro','shield','pd','aegis','gen','battery','sell'];
export const COL: Record<'p'|'e'|'a', Partial<Record<Cell, string>>> = {
  p:{core:'#ffffff', hull:'#bcd0f5', armor:'#86a6e6', cannon:'#a8ecff', bigcannon:'#a8ecff', bigcannon_b:'#7fb0d0', gatling:'#a8ecff', hgatling:'#a8ecff', hgatling_b:'#7fb0d0', missile:'#ffe08a', engine:'#ffb27a', pd:'#c9adff', mirv:'#ff9ad0', mirv_b:'#c070a0', gyro:'#8ff0c8',
     laser:'#9dff8a', laser_b:'#72d86a', glimmer:'#d0f5c8', rail:'#efe6ff', rail_b:'#b9a8f0', shield:'#5fd3ff', gen:'#ffd04a', battery:'#7fe07a',
     fbay:'#a8ecff', fbay_b:'#7fb0d0', bbay:'#ffc46b', bbay_b:'#c09050', scatter:'#a8ecff', ion:'#7fd8ff', goo:'#9cff5a', hack:'#4affb0', tesla:'#c8b0ff', torpedo:'#ffe08a', torpedo_b:'#c0a050', aegis:'#c9adff', aegis_b:'#8a70c0', swarm_b:'#a8a070', mine:'#ffb27a'},
  e:{core:'#ffd6cc', hull:'#ff7a66', armor:'#d0504a', cannon:'#ffc46b', gatling:'#ffc46b', missile:'#ffc46b', flak:'#ffc46b', rail:'#ffc46b', plasma:'#ffc46b', swarm:'#ffc46b', bigcannon:'#ffc46b', hgatling:'#ffc46b', scatter:'#ffc46b', ion:'#ffc46b', goo:'#ffc46b', hack:'#ffc46b', mirv:'#ffc46b', laser:'#ffc46b', glimmer:'#ffc46b', tesla:'#ffc46b', shield:'#5fd3ff', gen:'#ffd04a', bay:'#9a4630', pd:'#c9adff', engine:'#ff9a6a'},
  a:{},
}; // hangar craft
export const BCOL: Record<string, string> = {pellet:'#fff0a0', ion:'#a070ff', torp:'#ffd04a', mine:'#ff7a3a', shot:'#7fe8ff', oval:'#5fd8ff', slug:'#9fe4ff', line:'#7ff6ff', miss:'#ffe08a', mirv:'#ff7ad8', flak:'#ff9a3a', plasma:'#ff4ad0', goo:'#9cff5a', hack:'#4affb0', egoo:'#e8c040', ehack:'#ff4a8a', aim:'#ff8a2a', ring:'#ff4ad0', snipe:'#ff2a2a', eoval:'#ff8a2a', egat:'#ff6a3a', eflak:'#ffb03a', emiss:'#ff5a3a'};
// Hull and armor are plating: bought with credits in drydock. Every other block comes out of cargo.
export const PLATE = (t: Cell) => t==='hull' || t==='armor' || WEDGE(t);
/** Corner plating: a half-cell triangle whose cut corner faces one of the four diagonals (an odd facing). */
export const WEDGE = (t: Cell) => t==='hullc' || t==='armorc';
/** The facing a block is placed with: 0 for blocks that don't turn, a diagonal for corner plating. */
export const faceFor = (t: Cell, o: Facing): Facing => !T[t as BlockType]?.rot ? 0 : WEDGE(t) ? (o | 1) as Facing : o;
export const onShip = (t: BlockType) => { for (const v of G.design.values()) if (v===t) return true; return false; };
export const owned = (t: BlockType) => t==='sell' || PLATE(t) || (G.inv[t]||0) > 0 || onShip(t) || (G.outfit && unlocked(t));
// Outfitting: before the first jump of a run, any unlocked block can be bought straight onto the ship with the starting budget.
export const outfitPrice = (t: BlockType) => Math.round(T[t].cost*priceMul());
export const canBuyHere = (t: BlockType) => G.outfit && !PLATE(t) && unlocked(t);
// sectors map onto the old stage tiers: which blocks drop and which weapons enemies carry
export const tierOf = (s: number) => Math.floor(s*1.5 + 1);
// Cockpits: the core comes in variants picked in Engineering. Each brings its own core gun, a right-click ability with a
// cooldown (s), and bonuses: turn and range multiply, en scales the core's energy, coreHp its hit points, and small ships
// (small:true) get faster, quicker to turn and tougher the fewer blocks they have (see smallK).
type AbilityId = 'jump' | 'roll' | 'fire' | 'salvo' | 'scramble' | 'cloak';
const STD_GUN: GunDef = {range:220, cd:.35, spd:600, dmg:4, spread:.03, r:2, arc:Math.PI, over:true};
// craftHp and build scale hangar craft health and bay rebuild speed; mrl scales how fast missile and torpedo launchers reload.
export const COCKPITS: Record<'std' | 'fighter' | 'cruiser' | 'carrier' | 'battle' | 'phantom', {name: string; turn: number; range: number; unlock: number; off: boolean;
  gun?: GunDef; ab: AbilityId; abName: string; abCd: number; en: number; coreHp: number; small: boolean; arc: number; craftHp?: number; build?: number; mrl?: number;
  /** the cockpit's other cells round the core, [right, back] (front is -back) */ cells: [number, number][]; /** launches its own fighter */ deck?: boolean}> = {
  std:    {name:'Standard cockpit', turn:1, range:1, unlock:1, off:false,
    gun:STD_GUN, ab:'jump', abName:'Jump: warp a short way toward the mouse', abCd:8, en:1, coreHp:1, small:false, arc:1, cells:[]},
  fighter:{name:'Corvette cockpit', turn:1, range:1, unlock:2, off:false,
    gun:{range:200, cd:.13, spd:720, dmg:1.3, spread:.05, r:1.6, arc:Math.PI, over:true, pellets:2, fan:.07}, ab:'roll', abName:'Evasive roll: a burst of speed, untouchable for half a second', abCd:6, en:1, coreHp:.7, small:true, arc:1.25, cells:[[0,1]]},
  cruiser:{name:'Cruiser bridge', turn:.85, range:1, unlock:4, off:false,
    gun:{range:700, cd:1.4, spd:220, dmg:6, spread:.3, r:2, arc:Math.PI, over:true, homing:true}, ab:'salvo', abName:'Salvo: every missile and torpedo launcher fires at once', abCd:15, en:1, coreHp:1, small:false, arc:1, mrl:1.25, cells:[[1,0],[0,1],[1,1]]},
  carrier:{name:'Carrier deck', turn:1, range:1, unlock:5, off:false,
    deck:true, ab:'scramble', abName:'Scramble: every bay launches or refits its craft at once', abCd:25, en:1, coreHp:1, small:false, arc:1, craftHp:1.25, build:1.5, cells:[[0,-1],[0,1],[0,2]]},
  battle: {name:'Command bridge', turn:.7, range:1.1, unlock:7, off:false,
    gun:{range:300, cd:.9, spd:520, dmg:14, spread:.015, r:3, arc:Math.PI, over:true, fx:'oval'}, ab:'fire', abName:'Fire control: every weapon fires 50% faster for 4 s', abCd:20, en:1, coreHp:2, small:false, arc:1, cells:[[-1,0],[1,0],[0,1]]},
  phantom:{name:'Phantom bridge', turn:1.1, range:1, unlock:10, off:false,
    gun:{range:480, cd:1.6, spd:950, dmg:18, spread:.005, r:2, arc:Math.PI, over:true, fx:'line'}, ab:'cloak', abName:'Cloak: enemies lose track of you for 3 s', abCd:18, en:1, coreHp:.8, small:false, arc:1, cells:[[0,-1],[0,1]]},
};
export type CockpitId = keyof typeof COCKPITS;
export const cockpit = () => COCKPITS[G.cockpit] || COCKPITS.std;
// the standard cockpit is there from the start; the others unlock with the best sector reached, like blocks.
// off: switched off for now, hidden from Engineering and never flown.
/** How much of a small-ship cockpit's edge applies: 1 at 15 blocks or fewer, fading to 0 at 40. */
export const smallK = () => cockpit().small ? Math.min(1, Math.max(0, (40 - blockCount())/25)) : 0;
/** A player turret's firing arc with the cockpit's widening (all-round guns stay all-round). */
export const cpArc = (a: number) => a >= Math.PI - .01 ? a : Math.min(Math.PI, a*cockpit().arc);
export const cpTurn = () => cockpit().turn*(1 + .6*smallK());
export const cpSpeed = () => 1 + .6*smallK();
export const cpGuard = () => 1 - .4*smallK();
/** A cockpit's bonuses and drawbacks as short tags, for the Engineering list. */
export function cpPerks(id: CockpitId){
  const C = COCKPITS[id], out: string[] = [];
  if (C.small) out.push('Nimble when small');
  if (C.turn !== 1) out.push(C.turn > 1 ? 'Quick turns' : 'Slow turns');
  if (C.range > 1) out.push('Long range');
  if (C.arc > 1) out.push('Wide arcs');
  if (C.mrl) out.push('Fast missiles');
  if (C.deck) out.push('Own fighter');
  if (C.craftHp || C.build) out.push('Better craft');
  if (C.coreHp !== 1) out.push(C.coreHp > 1 ? 'Tough core' : 'Fragile core');
  return out;
}
export const cpUnlocked = (id: CockpitId) => !COCKPITS[id].off && COCKPITS[id].unlock <= (G.meta.best || 1);
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
export const WGRP: Partial<Record<Cell, number>> = {plasma:1, swarm:2, core:1, cannon:1, bigcannon:1, gatling:1, hgatling:1, scatter:1, flak:1, ion:1, goo:1, hack:3, laser:1, missile:2, mirv:2, rail:3, torpedo:3, mine:4, tesla:4, glimmer:4};
export const GCOL = ['#5fd8ff','#ffc46b','#ff7ad8','#9dff8a','#ff9a7a'];
export const isWeapon = (t: Cell | undefined) => !!t && !!WGRP[t] && (t!=='core' || !!cockpit().gun);
/** What a bay launches: a hangar bay's craft, or a fighter from the Carrier deck's core. */
export const bayKind = (b: {t: Cell}): CraftKind | null => isCraft(b.t) ? b.t : b.t==='core' && cockpit().deck ? 'fbay' : null;
export const grpOf = (k: Key, t: Cell) => G.grp[k] || WGRP[t] || 1;
// What menus say about a block: weapons, point defense and hangars get a line of numbers; everything else its short description.
const m = (u: number) => Math.round(u/BS) + ' m', n1 = (v: number) => (Math.round(v*10)/10).toString();
export function blurb(t: BlockType){
  const d = T[t], g = d.gun;
  if (g) return [`${n1(g.dmg*(g.pellets || 1)*(g.mirv || 1)/g.cd)} dmg/s`, g.range ? m(g.range) : '', g.homing ? 'homing' : (g.arc ?? Math.PI) >= Math.PI - .01 ? 'all round' : `±${Math.round((g.arc || 0)*180/Math.PI)}°`, g.over ? 'fires over hull' : ''].filter(Boolean).join(' · ');
  if (d.laser) return `${d.laser.dps} dmg/s up close · ${m(d.laser.range)} · ${d.laser.arc ? `±${Math.round(d.laser.arc*180/Math.PI)}° beam` : 'beam'}`;
  if (d.rail) return `pierces ${d.rail.pool} · every ${d.rail.cd} s · ${m(d.rail.range)}`;
  if (d.tesla) return `${d.tesla.dmg} × ${d.tesla.jumps} chain · every ${d.tesla.cd} s · ${m(d.tesla.range)}`;
  if (d.pd) return `intercepts every ${d.pd.cd} s · ${m(d.pd.range)}${d.pd.heavy ? ' · stops slugs' : ''}`;
  if (isCraft(t)){ const C = CRAFT[t]; return `${t==='fbay' ? 'fighter' : 'bomber'} · ${n1(C.gun.dmg/C.gun.cd)} dmg/s · rebuilt in ${C.rebuild} s`; }
  return d.desc || '';
}
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
  // the core's own gun is the cockpit's
  Object.defineProperty(T.core, 'gun', {get: () => cockpit().gun, configurable:true});
}
