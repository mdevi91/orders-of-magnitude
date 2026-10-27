import { bossSize, eReach, lineGuns, makeFighter, shipSize, spawnWave, startFight } from './fights';
import { clamp } from './grid';
import { ACT } from './shop';
import { toDrydock } from './starmap';
import { G } from './state';
import type { ShipSpec } from './types';
import { showOverlay } from './ui';
import { $ } from './view';

// ---------- test simulation ----------
// A mock fight from the drydock against enemies picked by hand, flown with the whole design (damage ignored).
// The enemies are the current sector's. Nothing in it counts: credits, run stats and damage are put back when it ends,
// and losing ends only the test.
type MockId = 'fighter' | 'raider' | 'line' | 'cruiser' | 'carrier' | 'elite' | 'dread' | 'capital' | 'station';
const MOCK: {id: MockId; name: string; sub: string; max: number; spec?: (s: number) => ShipSpec}[] = [
  {id:'fighter', name:'Fighter', sub:'a small, quick escort', max:8},
  {id:'raider', name:'Raider', sub:'light and lightly armed', max:6, spec:s => ({n:Math.round(shipSize(s,1)*.6), guns:3 + Math.max(0, Math.floor((s - 4)/3))})},
  {id:'line', name:'Line ship', sub:'a patrol\'s main hull', max:6, spec:s => ({n:Math.round(shipSize(s,1)*1.3), guns:lineGuns(s)})},
  {id:'cruiser', name:'Cruiser', sub:'twice a line ship, more guns', max:4, spec:s => ({n:Math.round(shipSize(s,1)*2), guns:lineGuns(s) + 2})},
  {id:'carrier', name:'Carrier', sub:'launches fighters', max:3, spec:s => ({n:Math.round(shipSize(s,1)*1.7), guns:Math.max(1, lineGuns(s) - 1), bays:1 + (s >= 5 ? 1 : 0)})},
  {id:'elite', name:'Elite', sub:'a tough named warship', max:3, spec:s => ({n:Math.round(bossSize(s)*.5), elite:true, guns:lineGuns(s) + 2, bays:s >= 4 ? 1 : 0})},
  {id:'dread', name:'Dreadnought', sub:'one hulking gun platform', max:2, spec:s => ({n:Math.round(shipSize(s,1)*2.4), guns:lineGuns(s) + 6})},
  {id:'capital', name:'Flagship', sub:'a sector\'s capital ship', max:2, spec:s => ({n:Math.min(1300, bossSize(s)), boss:true, flag:true, guns:5 + Math.floor(s/2), bays:1 + Math.floor(s/3)})},
  {id:'station', name:'Starbase', sub:'holds still, very big', max:1, spec:s => ({n:Math.min(1300, Math.round(bossSize(s)*1.8)), boss:true, flag:true, station:true, guns:s >= 6 ? 12 : 8, bays:4})},
];
const count: Record<MockId, number> = {fighter:0, raider:2, line:0, cruiser:0, carrier:0, elite:0, dread:0, capital:0, station:0};
// what the run had before the test, put back when it ends
let snap: {credits: number; stats: string | null; stage: number; spanT: number; span0: number; spanStage: number | null; bounty: number; broken: Set<number>; t0: number} | null = null;

export function simSetup(){
  const any = MOCK.some(m => count[m.id] > 0);
  showOverlay('Test simulation', `<p>Fly your current design, whole and repaired, against mock enemies. Nothing carries over: no credits, no loot, no damage, and losing ends only the test.</p>` +
    `<div class="rows"><h3>Sector ${G.stage} enemies</h3>` +
    MOCK.map(m => `<div class="row"><span>${m.name}<small>${m.sub}</small></span><span class="tsec">` +
      `<button class="rot" type="button" data-act="sim:-${m.id}"${count[m.id] ? '' : ' disabled'} aria-label="Fewer">−</button><b class="simn">${count[m.id]}</b>` +
      `<button class="rot" type="button" data-act="sim:+${m.id}"${count[m.id] < m.max ? '' : ' disabled'} aria-label="More">+</button></span></div>`).join('') + '</div>',
    any ? [['Start simulation', startSim], ['Back', toDrydock, 'ghost']] : [['Back', toDrydock, 'ghost']], false, {eye:'Drydock'});
}
export function startSim(){
  snap = {credits:G.credits, stats:G.stats ? JSON.stringify(G.stats) : null, stage:G.stage, spanT:G.spanT, span0:G.span0, spanStage:G.spanStage, bounty:G.bounty, broken:new Set(G.broken), t0:G.time};
  G.sim = true; G.broken = new Set();
  const sector = G.stage;
  startFight(count.station ? 'station' : 'fight');
  const wave: ShipSpec[] = [];
  for (const m of MOCK) if (m.spec) for (let n=0; n<count[m.id]; n++) wave.push(m.spec(sector));
  G.waves = Object.assign(wave.length ? [wave] : [], {name:'Test simulation'}); G.waveIdx = 0; G.waveGap = 0;
  // fighters come straight in; the rest arrive as one wave on the first frame
  for (let n=0; n<count.fighter; n++){ const a = Math.random()*Math.PI*2, p = G.player!, d = 300*G.SC + p.r; makeFighter(p.x + Math.cos(a)*d, p.y + Math.sin(a)*d, sector); }
  if (wave.length){ G.waveIdx = 1; spawnWave(wave); }
  // enemy guns reach further in later sectors, so the test starts that much further apart, with the view pulled back to match
  const k = eReach(), p = G.player!;
  for (const e of G.ships) if (e.team==='e' && !e.station){ e.x = clamp(p.x + (e.x - p.x)*k, e.r, G.AW - e.r); e.y = clamp(p.y + (e.y - p.y)*k, e.r, G.AH - e.r); }
  G.span = G.span0 *= k; G.spanT *= k;
  G.banner = {text:'Test simulation', sub:`Sector ${sector} mock enemies`, t:2};
}
/** Puts the run back the way it was before the test. */
function restore(){
  if (!snap) return;
  G.credits = snap.credits; G.stats = snap.stats ? JSON.parse(snap.stats) : null; G.stage = snap.stage; G.spanT = snap.spanT; G.span0 = snap.span0; G.spanStage = snap.spanStage;
  G.bounty = snap.bounty; G.broken = snap.broken; G.lost = new Set(); G.sim = false; snap = null;
}
/** The test is over: every mock enemy down (won) or the ship lost. */
export function simOver(won: boolean){
  const secs = Math.round(G.time - (snap?.t0 ?? G.time));
  G.mode = 'clear'; restore();
  showOverlay(won ? 'Simulation won' : 'Ship destroyed', won ? `Every mock enemy down in <b>${secs} s</b>.` : `Your ship was lost after <b>${secs} s</b>.`,
    [['Run again', startSim], ['Change enemies', simSetup, 'ghost'], ['Back to drydock', toDrydock, 'ghost']], false, {eye:'Test simulation'});
}
/** Leaves the test from the pause menu. */
export function endSim(){ G.mode = 'clear'; restore(); toDrydock(); }

// wiring that runs once at start-up
export function init(){
  $('simBtn').addEventListener('click', simSetup);
  ACT.sim = v => {
    const m = MOCK.find(x => x.id === v.slice(1)); if (m) count[m.id] = Math.max(0, Math.min(m.max, count[m.id] + (v[0]==='+' ? 1 : -1)));
    simSetup(); return true;
  };
}
