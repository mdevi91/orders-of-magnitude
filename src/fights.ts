import { sfx } from './audio';
import { ewOf, pickWeapon, tierOf } from './catalog';
import { CORE, K, KI, KJ, NB, TAU, clamp, rand } from './grid';
import { abandon } from './controls';
import { undoStack } from './input';
import { chooseLoot, inc, lootText } from './loot';
import { runOver } from './runs';
import { save } from './save';
import { showOptions } from './options';
import { genDesign, gunDirs, makeShip } from './ships';
import { NODE, goOn, nextSector, toMap } from './starmap';
import { G, blockCount, scaleOf, spanFor } from './state';
import { tut } from './tutorial';
import { designStats, hideOverlay, showOverlay, syncUI, toast } from './ui';
import { keys } from './update';
import type { EnemyCell, FightKind, Key, Ship, ShipSpec, Wave, WavePlan } from './types';
import { H, W } from './view';

// ---------- fights ----------
// capital ships: a few times a fresh player's ship in that sector
export const bossSize = (s: number) => Math.round(14*Math.pow(s,1.35));
export const fodderCap = () => Math.min(3, 1 + Math.floor(G.stage/3));
// enemy fighters and bombers alive at once
export const craftCap = () => Math.min(6, 3 + Math.floor(G.stage/3));
// a line ship is a bit smaller than a fresh player's ship in that sector (about 11 blocks in sector 1, 25 in 3, 60 in 6, 100 in 9)
export const shipSize = (s: number, col: number) => Math.max(4, Math.round((4 + 3*s + .6*s*s)*(1 + .07*col)*rand(.9,1.15)));
// credits for winning: base plus a per-sector part
const BOUNTY: Record<FightKind, [number, number]> = {fight:[10,4], ambush:[8,3], elite:[20,7], gate:[30,10], boss:[75,25], station:[80,28]};
// every enemy shot hits a little harder each sector, so fewer guns still keep up
export const eDmg = () => 1.25 + .3*(G.stage-1);
// Waves for one fight: few ships, but big and tough ones. Gun caps keep it readable. Turrets face outward and only some bear
// on any one target, so a ship carries more guns than it can fire at once.
export function planFight(kind: FightKind, s: number, col: number): WavePlan {
  const waves: WavePlan = [], g = Math.min(4 + s, 2 + 2*s), ship = (m=1, x: Partial<ShipSpec> = {}): ShipSpec => ({n:Math.round(shipSize(s,col)*m), guns:g, ...x});
  if (kind==='fight'){
    // a random encounter: a patrol, a lone cruiser, a carrier, or a pack of light raiders
    const r = Math.random();
    if (r < .3){ waves.name = 'Cruiser'; waves.push([ship(2, {guns:g+2})]); }
    else if (r < .5 && s >= 2){ waves.name = 'Carrier'; waves.push([ship(1.7, {guns:Math.max(1, g-1), bays:1 + (s >= 5 ? 1 : 0)})]); }
    else if (r < .7){ waves.name = 'Raiders'; waves.push(Array.from({length:2 + (s >= 3 ? 1 : 0) + (Math.random() < s/10 ? 1 : 0)}, () => ship(.6, {guns:3}))); }
    else { waves.name = 'Patrol'; waves.push([ship(1.3), ...(s >= 2 && Math.random() < .6 ? [ship(.8)] : [])]); }
    if (col >= 4 && Math.random() < .35) waves.push([ship(1.2)]);
  } else if (kind==='ambush') waves.push([ship(1.3), ...(s >= 5 ? [ship(.8)] : [])]);
  else if (kind==='elite') waves.push([{n:Math.round(bossSize(s)*.5), elite:true, guns:g+2, bays:s >= 4 ? 1 : 0}]);
  else if (kind==='gate'){
    waves.push([ship(.9), ...(s >= 4 ? [ship(.7)] : [])]);
    waves.push([{n:Math.round(bossSize(s)*.8), boss:true, guns:4 + Math.floor(s/2), bays:s >= 3 ? 1 : 0}]);
  } else if (kind==='boss') waves.push([{n:Math.min(1300, Math.round(bossSize(s))), boss:true, flag:true, guns:5 + Math.floor(s/2), bays:1 + Math.floor(s/3)}]);
  else if (kind==='station') waves.push([{n:Math.min(1300, Math.round(bossSize(s)*1.8)), boss:true, flag:true, station:true, guns:s >= 6 ? 12 : 8, bays:4}]);
  return waves;
}
// Carrier bays go on the rim, in mirrored pairs.
export function addBays(d: Map<Key, EnemyCell>, n: number){
  const nbs = (k: Key) => NB.filter(o => d.has(k+o)).length;
  for (let c=0; c<n; c++){
    const pool = [...d.keys()].filter(k => (d.get(k)==='hull' || d.get(k)==='armor') && nbs(k) <= 2);
    if (!pool.length) return;
    const k = pool[(Math.random()*pool.length)|0], mk = K(-KI(k), KJ(k));
    d.set(k,'bay'); if (d.get(mk)==='hull' || d.get(mk)==='armor') d.set(mk,'bay');
  }
}
// Starbase: a hub, four spokes and a ring, grown with fourfold symmetry. Guns, shields and bays sit on the rim, generators deep inside.
export function genStation(n: number, stage: number, guns: number, bays: number){
  const d = new Map<Key, EnemyCell>([[CORE,'core']]), keys = [CORE];
  const put = (i: number, j: number, t: EnemyCell) => { for (const [a,b] of [[i,j],[-j,i],[-i,-j],[j,-i]]){ const k = K(a,b); if (!d.has(k)){ d.set(k,t); keys.push(k); } } };
  const R = Math.max(5, Math.round(Math.sqrt(n)*.42));
  for (let i=-1; i<=1; i++) for (let j=-1; j<=1; j++) if (i || j) put(i,j,'armor');
  for (let r=2; r<=R; r++){ put(0,-r,'armor'); put(1,-r,'hull'); }
  for (let q=0; q<R*2; q++){ const a = q/(R*8)*TAU; for (const w of [0,1]) put(Math.round(Math.cos(a)*(R-w)), Math.round(Math.sin(a)*(R-w)), w ? 'hull' : 'armor'); }
  let tries = 0;
  while (d.size < n && tries++ < n*20){
    const base = keys[(Math.random()*keys.length)|0], nk = base + NB[(Math.random()*4)|0];
    if (d.has(nk) || Math.max(Math.abs(KI(nk)), Math.abs(KJ(nk))) > R + 6) continue;
    put(KI(nk), KJ(nk), Math.random() < .35 ? 'armor' : 'hull');
  }
  const nbs = (k: Key) => NB.filter(o => d.has(k+o)).length;
  const conv = (t: EnemyCell | (() => EnemyCell), count: number, inner: boolean) => {
    for (let c=0; c<count; c++){
      const pool = [...d.keys()].filter(k => (d.get(k)==='hull' || d.get(k)==='armor') && (inner ? nbs(k)===4 : nbs(k) <= 2));
      if (!pool.length) return;
      const k = pool[(Math.random()*pool.length)|0], i = KI(k), j = KJ(k);
      for (const [a,b] of [[i,j],[-j,i],[-i,-j],[j,-i]]){ const kk = K(a,b); if (d.get(kk)==='hull' || d.get(kk)==='armor') d.set(kk, typeof t==='function' ? t() : t); }
    }
  };
  conv(() => pickWeapon(stage), Math.ceil(guns/4), false);
  conv('bay', Math.ceil(bays/4), false);
  if (stage >= 3) conv('shield', 1 + Math.floor(d.size/400), false);
  if (stage >= 4) conv('gen', 1 + Math.floor(d.size/500), true);
  if (stage >= 5) conv('pd', 1 + Math.floor(d.size/350), false);
  return d;
}
export function spawnPos(){
  const p = G.player!, m = .08;
  for (let t=0; t<30; t++){
    const side = (Math.random()*3)|0;
    const x = side===0 ? rand(m,1-m)*G.AW : side===1 ? m*G.AW : (1-m)*G.AW;
    const y = side===0 ? m*G.AH : rand(m,.6)*G.AH;
    if (Math.hypot(x-p.x, y-p.y) > .4*Math.min(G.AW,G.AH)) return {x,y};
  }
  return {x:G.AW/2, y:G.AH*.1};
}
export function spawnWave(list: Wave){
  const hpMul = 1.15 + .22*(G.stage-1), tier = tierOf(G.stage);
  let boss: Ship | null = null;
  for (const spec of list){
    const d = spec.station ? genStation(spec.n, tier, spec.guns, spec.bays || 0) : genDesign(spec.n, !!(spec.boss || spec.elite), tier, spec.guns), pos = spawnPos();
    if (spec.bays && !spec.station) addBays(d, spec.bays);
    // a starbase has so many blocks that each one is lighter
    const e = makeShip(d,'e',pos.x,pos.y,hpMul*(spec.elite ? 1.3 : spec.station ? .5 : 1), gunDirs(d));
    e.boss = !!spec.boss; e.elite = !!spec.elite; e.flag = !!spec.flag; e.station = !!spec.station; e.n0 = d.size; e.phaseN = 1;
    if (e.boss) boss = e;
    e.sc = G.SC; e.ft = 3; e.phase = rand(0,TAU); e.spin = Math.random()<.5 ? 1 : -1;
    e.orb = rand(0,TAU); e.orbSpd = rand(.12,.35)*(Math.random()<.5 ? 1 : -1);
    // railgun ships hang back
    e.pref = (spec.boss ? 360 : e.guns.some(g => g.t==='rail') ? rand(420,520) : rand(220,380))*G.SC + e.r;
    // close in until the shortest-ranged gun can reach
    if (e.guns.length) e.pref = Math.min(e.pref, Math.min(...e.guns.map(g => ewOf(g.t)!.range))*.75*G.SC + e.r*.5);
    e.vmax = 200/Math.sqrt(1 + d.size/30); e.turn = 1.6/Math.sqrt(1 + d.size/20);
    // salvage grows with the square root of size, so big late-game hulls don't flood the run with credits
    e.value = inc((4 + Math.sqrt(d.size)*2.2)*(spec.flag ? 5 : spec.boss ? 3 : spec.elite ? 2 : 1));
    e.a = Math.atan2(G.player!.x-e.x, -(G.player!.y-e.y)); e.c = Math.cos(e.a); e.sn = Math.sin(e.a);
    if (e.station){
      // the starbase holds still above the player (startFight made the arena tall enough)
      const p = G.player!, gap = e.r + p.r + 320*G.SC;
      G.AW = Math.max(G.AW, e.r*2 + 600*G.SC); G.AH = Math.max(G.AH, e.r*2 + 600*G.SC);
      e.x = clamp(p.x, e.r + 40, G.AW - e.r - 40); e.y = Math.max(e.r + 40, p.y - gap); e.vmax = 0; e.a = 0; e.c = 1; e.sn = 0;
    }
    warpIn(e); G.ships.push(e);
  }
  if (boss) G.boss = boss;
  const B = boss as Ship | null;
  G.banner = {text: G.waves.length > 1 ? `Wave ${G.waveIdx}/${G.waves.length}` : G.waves.name || NODE[G.fight].name,
    sub: B ? (B.station ? 'Enemy starbase' : B.flag ? 'Enemy flagship' : 'Capital ship inbound') : `${list.length} hostile${list.length>1 ? 's' : ''}`, red:!!B, t:2.4};
}
// Swarm: flights of ships sized like earlier sectors arrive during gate and flagship fights, so a grown hull towers over them.
export function spawnSwarm(){
  const p = G.player!, s = G.stage;
  const tier = 1 + Math.floor(Math.random()**2 * (s-1)), tS = Math.pow(scaleOf(tier),.8);
  const ang = rand(0,TAU), dist = .5*Math.hypot(W,H)/G.zoom + 40;
  const cx = clamp(p.x + Math.cos(ang)*dist, 0, G.AW), cy = clamp(p.y + Math.sin(ang)*dist, 0, G.AH);
  const flight = 1;
  for (let q=0; q<flight; q++) makeFighter(cx + rand(-40,40)*tS, cy + rand(-40,40)*tS, tier);
}
export function makeFighter(x: number, y: number, tier: number){
  const p = G.player!, tS = Math.pow(scaleOf(tier),.8);
  {
    const d = genDesign(Math.round((4 + 2*Math.pow(tier,1.2))*rand(.85,1.1)), false, tierOf(tier), 2);
    const e = makeShip(d,'e', clamp(x, 0, G.AW), clamp(y, 0, G.AH), 1, gunDirs(d));
    e.fodder = true; e.sc = tS;
    e.orb = rand(0,TAU); e.orbSpd = rand(.3,.6)*(Math.random()<.5 ? 1 : -1);
    e.pref = p.r + rand(140,260)*tS + e.r;
    e.vmax = 190/Math.sqrt(1 + d.size/30); e.turn = 2.4;
    e.value = inc(2 + Math.sqrt(d.size));
    e.a = Math.atan2(p.x-e.x, -(p.y-e.y)); e.c = Math.cos(e.a); e.sn = Math.sin(e.a);
    warpIn(e); G.ships.push(e);
  }
}
// Enemies arrive out of a space jump: they streak in from far away along the line past the player, stretched and flickering,
// and drop out with a flash. Until then they can't be hit and don't act.
export const WARP = .7;
export function warpIn(e: Ship){
  const p = G.player!, a = Math.atan2(e.y-p.y, e.x-p.x);
  // drop out of the jump where the player can see it: on the same bearing, but inside the view
  if (!e.station){
    const d = Math.min(Math.hypot(e.x-p.x, e.y-p.y), Math.max(e.r + p.r + 60*G.SC, G.span*G.camMul*.4));
    e.x = clamp(p.x + Math.cos(a)*d, e.r, G.AW - e.r); e.y = clamp(p.y + Math.sin(a)*d, e.r, G.AH - e.r);
  }
  e.warp = WARP + rand(0,.5); e.warpA = a + rand(-.4,.4);
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
  undoStack.length = 0; G.fight = kind; G.lost = new Set(); G.boss = null; G.abT = 0; G.abReq = false;
  if (G.stats) G.stats.peak = Math.max(G.stats.peak || 0, blockCount());
  G.S = scaleOf(G.stage); G.SC = Math.pow(G.S,.8);
  const p = G.player = makeShip(flyDesign(),'p',0,0,1,G.dirs);
  // every sector opens on last sector's view and slowly pulls back to a wider one, even if the hull didn't grow
  if (G.spanStage !== G.stage){ G.span0 = G.spanT ? G.spanT : spanFor(p.r, G.S)*.6; G.spanStage = G.stage; }
  G.spanT = Math.max(spanFor(p.r, G.S), G.span0*1.15); G.span = G.span0; G.fit = 0; G.spanAt = 0; G.swarmT = 4;
  G.AW = Math.max(1300*G.S, G.spanT*3); G.AH = Math.max(900*G.S, G.spanT*2.2);
  // a starbase needs room above the player
  if (kind==='station'){ G.AW *= 1.4; G.AH *= 2; }
  p.x = G.AW/2; p.y = G.AH*(kind==='station' ? .85 : .72);
  G.ships = [p]; G.pb = []; G.eb = []; G.fx = []; G.beams = [];
  G.waves = planFight(kind, G.stage, G.node ? G.node.col : 1); G.waveIdx = 0; G.waveGap = 2.5;
  G.camX = p.x; G.camY = p.y; G.joy = null; G.aimJoy = null; G.deadT = 0; G.earned = 0; G.paused = false;
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
        [['Keep going', nextSector], ['End run', () => runOver('won'), 'ghost']], false, {eye:'Combat report · run won', ac:'var(--line)'});
      return;
    }
    const nx = G.stage + 1;
    showOverlay(kind==='station' ? 'Starbase destroyed' : kind==='boss' ? 'Flagship destroyed' : `Sector ${G.stage} cleared`, text + ` The gate is open. Sector ${nx} is next${nx%3===0 ? ', and a flagship or starbase guards it' : ''}.`,
      [[`Jump to sector ${nx}`, nextSector], ['Star map', toMap, 'ghost']], false, {eye:'Combat report · gate open', ac:'var(--line)'});
  } else showOverlay('Victory', text, [[G.pendingNode ? 'Continue' : 'Star map', goOn]], false, {eye:'Combat report'});
  save();
}
export function playerDied(){ G.mode = 'dead'; runOver('dead'); }
export function flee(){ keepDamage(); G.pendingNode = null; G.bounty = 0; toast('You jumped away'); toMap(); }
export function togglePause(){
  if (G.mode!=='combat') return;
  G.paused = !G.paused;
  if (G.paused) pauseMenu(); else hideOverlay();
}
export function pauseMenu(){
  showOverlay('Paused', `${NODE[G.fight].name}, wave ${G.waveIdx} of ${G.waves.length}. Fleeing keeps the damage you took and gives no reward.`,
    [['Resume', togglePause], ['Options', () => showOptions(pauseMenu), 'ghost'], ['Flee', flee, 'ghost'], ['Abandon run', abandon, 'ghost reset']], false, {eye:'Paused'});
}
