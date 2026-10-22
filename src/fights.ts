import { sfx } from './audio';
import { ewOf, pickWeapon, tierOf } from './catalog';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { CORE, K, KI, KJ, KL, NB, TAU, clamp, rand } from './grid';
import { undoStack } from './input';
import { chooseLoot, inc, lootText } from './loot';
import { runOver } from './runs';
import { save } from './save';
import { genDesign, makeShip, randDir } from './ships';
import { NODE, goOn, nextSector, toMap } from './starmap';
import { G, scaleOf } from './state';
import { tut } from './tutorial';
import { designStats, hideOverlay, showOverlay, syncUI, toast } from './ui';
import type { EnemyCell, FightKind, Key, Ship, ShipSpec, Wave, WavePlan } from './types';

// ---------- fights ----------
export const bossSize = (s: number) => Math.round(32*Math.pow(s,1.45));
export const fodderCap = () => Math.min(3, 1 + Math.floor(G.stage/3));
// enemy fighters and bombers alive at once
export const craftCap = () => Math.min(6, 3 + Math.floor(G.stage/3));
export const shipSize = (s: number, col: number) => Math.round((20 + 11*Math.pow(s,1.3))*(1 + .07*col)*rand(.9,1.15));
// credits for winning: base plus a per-sector part
const BOUNTY: Record<FightKind, [number, number]> = {fight:[10,4], ambush:[8,3], elite:[20,7], gate:[30,10], boss:[75,25], station:[80,28]};
// every enemy shot hits a little harder each sector, so fewer guns still keep up
export const eDmg = () => 1.25 + .3*(G.stage-1);
// Waves for one fight: few ships, but big and tough ones. Gun caps keep it readable: a few heavy guns per ship instead of a wall of small ones.
export function planFight(kind: FightKind, s: number, col: number): WavePlan {
  const waves: WavePlan = [], g = 3 + Math.floor(s/2), ship = (m=1, x: Partial<ShipSpec> = {}): ShipSpec => ({n:Math.round(shipSize(s,col)*m), guns:g, ...x});
  if (kind==='fight'){
    // a random encounter: a patrol, a lone cruiser, a carrier, or a pack of light raiders
    const r = Math.random();
    if (r < .3){ waves.name = 'Cruiser'; waves.push([ship(2, {guns:g+2})]); }
    else if (r < .5 && s >= 2){ waves.name = 'Carrier'; waves.push([ship(1.7, {guns:Math.max(1, g-1), bays:1 + (s >= 5 ? 1 : 0)})]); }
    else if (r < .7){ waves.name = 'Raiders'; waves.push(Array.from({length:2 + (s >= 3 ? 1 : 0) + (Math.random() < s/10 ? 1 : 0)}, () => ship(.6, {guns:2}))); }
    else { waves.name = 'Patrol'; waves.push([ship(1.3), ...(s >= 2 && Math.random() < .6 ? [ship(.8)] : [])]); }
    if (col >= 4 && Math.random() < .35) waves.push([ship(1.2)]);
  } else if (kind==='ambush') waves.push([ship(1.3), ...(s >= 5 ? [ship(.8)] : [])]);
  else if (kind==='elite') waves.push([{n:Math.round(bossSize(s)*.5), elite:true, guns:g+2, bays:s >= 4 ? 1 : 0}]);
  else if (kind==='gate'){
    waves.push([ship(1.3), ...(s >= 4 ? [ship()] : [])]);
    waves.push([{n:Math.round(bossSize(s)*1.1), boss:true, guns:4 + Math.floor(s/3), bays:s >= 3 ? 1 : 0}]);
  } else if (kind==='boss') waves.push([{n:Math.min(1300, Math.round(bossSize(s)*1.3)), boss:true, flag:true, guns:4 + Math.floor(s/3), bays:1 + Math.floor(s/3)}]);
  else if (kind==='station') waves.push([{n:Math.min(1300, Math.round(bossSize(s)*1.8)), boss:true, flag:true, station:true, guns:s >= 6 ? 12 : 8, bays:4}]);
  return waves;
}
/// Carrier bays go on the rim, in mirrored pairs.
export function addBays(d: Map<Key, EnemyCell>, n: number){
  for (let c=0; c<n; c++){
    const pool = [...d.keys()].filter(k => (d.get(k)==='hull' || d.get(k)==='armor') && NB.filter(o => !d.has(k+o)).length >= 2);
    if (!pool.length) return;
    const k = pool[(Math.random()*pool.length)|0], mk = K(-KI(k), KJ(k), KL(k));
    d.set(k,'bay'); if (d.get(mk)==='hull' || d.get(mk)==='armor') d.set(mk,'bay');
  }
}
// Starbase: a hub, four spokes, a ring and a mast, grown with fourfold symmetry around its vertical axis and mirrored top to bottom.
// Guns, shields and bays sit on the outside, generators deep inside.
export function genStation(n: number, stage: number, guns: number, bays: number){
  const d = new Map<Key, EnemyCell>([[CORE,'core']]), keys = [CORE];
  const twins = (i: number, j: number, l: number) => [[i,j,l],[-j,i,l],[-i,-j,l],[j,-i,l],[i,j,-l],[-j,i,-l],[-i,-j,-l],[j,-i,-l]];
  const put = (i: number, j: number, l: number, t: EnemyCell) => { for (const [a,b,c] of twins(i,j,l)){ const k = K(a,b,c); if (!d.has(k)){ d.set(k,t); keys.push(k); } } };
  const R = Math.max(4, Math.round(Math.cbrt(n)*1.1));
  for (let i=-1; i<=1; i++) for (let j=-1; j<=1; j++) for (let l=-1; l<=1; l++) if (i || j || l) put(i,j,l,'armor');
  for (let r=2; r<=R; r++){ put(0,-r,0,'armor'); put(1,-r,0,'hull'); }
  for (let r=2; r<=Math.round(R*.6); r++) put(0,0,r,'armor');
  for (let q=0; q<R*2; q++){ const a = q/(R*8)*TAU; for (const w of [0,1]) put(Math.round(Math.cos(a)*(R-w)), Math.round(Math.sin(a)*(R-w)), 0, w ? 'hull' : 'armor'); }
  let tries = 0;
  while (d.size < n && tries++ < n*20){
    const base = keys[(Math.random()*keys.length)|0], nk = base + NB[(Math.random()*6)|0];
    const i = KI(nk), j = KJ(nk), l = KL(nk);
    if (d.has(nk) || Math.max(Math.abs(i), Math.abs(j)) > R + 4 || Math.abs(l) > R*.6 + 1) continue;
    put(i, j, l, Math.random() < .35 ? 'armor' : 'hull');
  }
  const conv = (t: EnemyCell | (() => EnemyCell), count: number, inner: boolean) => {
    for (let c=0; c<count; c++){
      const pool = [...d.keys()].filter(k => (d.get(k)==='hull' || d.get(k)==='armor') && (inner ? NB.every(o => d.has(k+o)) : NB.filter(o => !d.has(k+o)).length >= 2));
      if (!pool.length) return;
      const k = pool[(Math.random()*pool.length)|0];
      for (const [a,b,cc] of twins(KI(k), KJ(k), KL(k)).slice(0,4)){ const kk = K(a,b,cc); if (d.get(kk)==='hull' || d.get(kk)==='armor') d.set(kk, typeof t==='function' ? t() : t); }
    }
  };
  conv(() => pickWeapon(stage), Math.ceil(guns/4), false);
  conv('bay', Math.ceil(bays/4), false);
  if (stage >= 3) conv('shield', 1 + Math.floor(d.size/400), false);
  if (stage >= 4) conv('gen', 1 + Math.floor(d.size/500), true);
  if (stage >= 5) conv('pd', 1 + Math.floor(d.size/350), false);
  return d;
}
const UP = new Vector3(0,1,0);
/** The orientation that points a ship's nose (local -z) from one point at another. */
export function faceQ(from: Vector3, to: Vector3, out = new Quaternion()){
  return out.setFromRotationMatrix(new Matrix4().lookAt(from, to, UP));
}
/** A point at the far end of the arena, away from the player. */
export function spawnPos(){
  const p = G.player!, out = new Vector3();
  for (let t=0; t<30; t++){
    out.set(rand(-.8,.8)*G.AW, rand(-.7,.7)*G.AH, rand(-.9,-.15)*G.AD);
    if (out.distanceTo(p.p) > .5*Math.min(G.AW, G.AD)) return out;
  }
  return out.set(0, 0, -.8*G.AD);
}
/** Keep a point inside the arena box. */
export const inArena = (v: Vector3) => v.set(clamp(v.x, -G.AW, G.AW), clamp(v.y, -G.AH, G.AH), clamp(v.z, -G.AD, G.AD));
/** A random axis to circle around, mostly upright so fights stay readable. */
const orbitAxis = () => new Vector3(rand(-.5,.5), 1, rand(-.5,.5)).normalize();
export function spawnWave(list: Wave){
  const hpMul = 1.15 + .22*(G.stage-1), tier = tierOf(G.stage), p = G.player!;
  let boss: Ship | null = null;
  for (const spec of list){
    const d = spec.station ? genStation(spec.n, tier, spec.guns, spec.bays || 0) : genDesign(spec.n, !!(spec.boss || spec.elite), tier, spec.guns);
    if (spec.bays && !spec.station) addBays(d, spec.bays);
    // a starbase has so many blocks that each one is lighter
    const e = makeShip(d,'e',spawnPos(),hpMul*(spec.elite ? 1.3 : spec.station ? .5 : 1));
    e.boss = !!spec.boss; e.elite = !!spec.elite; e.flag = !!spec.flag; e.station = !!spec.station; e.n0 = d.size; e.phaseN = 1;
    if (e.boss) boss = e;
    e.sc = G.SC; e.ft = 3; e.phase = rand(0,TAU); e.spin = Math.random()<.5 ? 1 : -1;
    e.orb = rand(0,TAU); e.orbSpd = rand(.12,.35)*(Math.random()<.5 ? 1 : -1); e.orbAxis = orbitAxis();
    // railgun ships hang back
    e.pref = (spec.boss ? 360 : e.guns.some(g => g.t==='rail') ? rand(420,520) : rand(220,380))*G.SC + e.r;
    // close in until the shortest-ranged gun can reach
    if (e.guns.length) e.pref = Math.min(e.pref, Math.min(...e.guns.map(g => ewOf(g.t)!.range))*.75*G.SC + e.r*.5);
    e.vmax = 200/Math.sqrt(1 + d.size/30); e.turn = 1.6/Math.sqrt(1 + d.size/20);
    // salvage grows with the square root of size, so big late-game hulls don't flood the run with credits
    e.value = inc((4 + Math.sqrt(d.size)*2.2)*(spec.flag ? 5 : spec.boss ? 3 : spec.elite ? 2 : 1));
    if (e.station){
      // the starbase holds still ahead of the player (startFight made the arena deep enough)
      G.AW = Math.max(G.AW, e.r + 400*G.SC); G.AH = Math.max(G.AH, e.r + 300*G.SC);
      e.p.set(0, 0, p.p.z - (e.r + p.r + 320*G.SC)); inArena(e.p); e.vmax = 0;
    }
    faceQ(e.p, p.p, e.q);
    G.ships.push(e);
  }
  if (boss) G.boss = boss;
  const B = boss as Ship | null;
  G.banner = {text: G.waves.length > 1 ? `Wave ${G.waveIdx}/${G.waves.length}` : G.waves.name || NODE[G.fight].name,
    sub: B ? (B.station ? 'Enemy starbase' : B.flag ? 'Enemy flagship' : 'Capital ship inbound') : `${list.length} hostile${list.length>1 ? 's' : ''}`, red:!!B, t:2.4};
}
// Swarm: flights of ships sized like earlier sectors arrive during gate and flagship fights, so a grown hull towers over them.
export function spawnSwarm(){
  const p = G.player!, s = G.stage;
  const tier = 1 + Math.floor(Math.random()**2 * (s-1));
  makeFighter(inArena(p.p.clone().add(randDir().multiplyScalar(700*G.SC))), tier);
}
export function makeFighter(at: Vector3, tier: number){
  const p = G.player!, tS = Math.pow(scaleOf(tier),.8);
  const d = genDesign(Math.round((7 + 3.2*Math.pow(tier,1.3))*rand(.85,1.1)), false, tierOf(tier), 2);
  const e = makeShip(d,'e', inArena(at.clone()), 1);
  e.fodder = true; e.sc = tS;
  e.orb = rand(0,TAU); e.orbSpd = rand(.3,.6)*(Math.random()<.5 ? 1 : -1); e.orbAxis = orbitAxis();
  e.pref = p.r + rand(140,260)*tS + e.r;
  e.vmax = 190/Math.sqrt(1 + d.size/30); e.turn = 2.4;
  e.value = inc(2 + Math.sqrt(d.size));
  faceQ(e.p, p.p, e.q);
  G.ships.push(e);
}
// The ship that flies: the design without its damaged blocks, and without anything they cut off from the core.
export function flyDesign(){
  const d = new Map([...G.design].filter(([k]) => !G.broken.has(k)));
  const seen = new Set([CORE]), q = [CORE];
  while (q.length){ const c = q.pop()!; for (const nb of NB){ const m = c+nb; if (d.has(m) && !seen.has(m)){ seen.add(m); q.push(m); } } }
  for (const k of [...d.keys()]) if (!seen.has(k)) d.delete(k);
  return d;
}
export function startFight(kind: FightKind){
  undoStack.length = 0; G.fight = kind; G.lost = new Set(); G.boss = null;
  G.S = scaleOf(G.stage); G.SC = Math.pow(G.S,.8);
  const p = G.player = makeShip(flyDesign(),'p',new Vector3(),1,G.dirs);
  // the arena: a box around the origin, wider and deeper than it is tall
  G.AW = G.AD = Math.max(800*G.S, p.r*14); G.AH = G.AW*.6;
  if (kind==='station') G.AD *= 1.6;
  p.p.set(0, 0, G.AD*.6);
  G.ships = [p]; G.pb = []; G.eb = []; G.fx = []; G.beams = [];
  G.waves = planFight(kind, G.stage, G.node ? G.node.col : 1); G.waveIdx = 0; G.waveGap = 2.5; G.swarmT = 4;
  G.joy = null; G.aimJoy = null; G.deadT = 0; G.earned = 0; G.paused = false;
  G.banner = {text:G.waves.name || NODE[kind].name, sub:`Sector ${G.stage}`, t:2};
  G.mode = 'combat'; hideOverlay(); syncUI(); tut('combat');
  const st = designStats(), n = st.badT + st.badW + st.badE;
  if (n) toast(`${n} block${n>1?'s':''} can't fire or thrust: marked ✕ in drydock`);
}
// Blocks destroyed in a fight stay damaged until repaired.
export function keepDamage(){ for (const k of G.lost) if (G.design.has(k)) G.broken.add(k); G.lost = new Set(); if (G.broken.size) tut('damage'); }
export function fightWon(){
  const kind = G.fight, st = G.stats!, dmg = [...G.lost].filter(k => G.design.has(k)).length, cap = kind==='boss' || kind==='station';
  G.mode = 'clear'; sfx('clear'); keepDamage();
  const bonus = inc(BOUNTY[kind][0] + BOUNTY[kind][1]*G.stage) + (G.bounty || 0);
  G.credits += bonus; G.bounty = 0;
  const nb = kind==='fight' ? (Math.random() < .6 ? 1 : 0) : {ambush:1, elite:2, gate:2, boss:3, station:4}[kind];
  if (kind==='elite') st.elites++;
  if (cap) st.flags++;
  // the gate opens before the loot pick, so a reload mid-pick doesn't close it again
  if (kind==='gate' || cap){ G.map!.done = true; st.sectors++; }
  const head = `Salvage <b class="gold">+${G.earned}</b>, bounty <b class="gold">+${bonus}</b>.`;
  save();
  if (nb) chooseLoot(nb, kind==='elite' || cap ? 1.6 : 1, 'Victory', head, got => fightResult(kind, cap, head + lootText(got), dmg));
  else fightResult(kind, cap, head, dmg);
}
export function fightResult(kind: FightKind, cap: boolean, text: string, dmg: number){
  text += dmg ? ` <b>${dmg}</b> block${dmg>1?'s':''} damaged: repair in drydock or at a shop.` : '';
  if (kind==='gate' || cap){
    if (cap && G.stage >= 9 && !G.stats!.won){
      G.stats!.won = true; save();
      showOverlay('Victory', text + ` The third ${kind==='station' ? 'starbase' : 'flagship'} is down: the run is won. Keep going for more data, or end the run here.`,
        [['Keep going', nextSector], ['End run', () => runOver('won'), 'ghost']]);
      return;
    }
    const nx = G.stage + 1;
    showOverlay(kind==='station' ? 'Starbase destroyed' : kind==='boss' ? 'Flagship destroyed' : `Sector ${G.stage} cleared`, text + ` The gate is open. Sector ${nx} is next${nx%3===0 ? ', and a flagship or starbase guards it' : ''}.`,
      [[`Jump to sector ${nx}`, nextSector], ['Star map', toMap, 'ghost']]);
  } else showOverlay('Victory', text, [[G.pendingNode ? 'Continue' : 'Star map', goOn]]);
  save();
}
export function playerDied(){ G.mode = 'dead'; runOver('dead'); }
export function flee(){ keepDamage(); G.pendingNode = null; G.bounty = 0; toast('You jumped away'); toMap(); }
export function togglePause(){
  if (G.mode!=='combat') return;
  G.paused = !G.paused;
  if (G.paused) showOverlay('Paused', `${NODE[G.fight].name}, wave ${G.waveIdx} of ${G.waves.length}. Fleeing keeps the damage you took and gives no reward.`,
    [['Resume', togglePause], ['Flee', flee, 'ghost']]);
  else hideOverlay();
}
