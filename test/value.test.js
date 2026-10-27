// Weapon value probe: is each weapon's price in line with what it does? Damage is measured in the fight loop, not read
// off the catalogue, so blasts, splash, pierce, falloff, misses and homing all count. Each weapon fires on a held trigger
// at a target straight ahead at 30%, 60% and 90% of its range, with unlimited energy so only the weapon is measured.
// The target is a wide plain-hull hulk whose blocks are as tough as a mid-run enemy's, so blasts can overkill a block
// and splash has neighbours to reach, as in a real fight; what counts is the hit points it really lost.
// Value = measured damage per second, scaled by reach, firing arc, firing over the hull, point-defense exposure, toughness,
// energy draw, the cells it takes and its weight.
// Prices should sit near the same credits per point of value; anything far from the median is flagged.
const LIST = ['cannon','scatter','gatling','hgatling','bigcannon','flak','plasma','ion','missile','mirv','swarm','torpedo','mine','laser','glimmer','rail','tesla'];
function armed(t){
  const len = PARTS[t] ? PARTS[t].len : 1, d = new Map([[CORE,'core'],[K(-1,0),'gen'],[K(1,0),'gen'],[K(0,1),'battery']]);
  for (const [i,j,ct] of cellsFor(0,-len,t,0)) d.set(K(i,j), ct);
  G.design = d; G.dirs = new Map([[K(0,-len),0]]); G.broken = new Set();
  startFight('fight'); G.waves = []; G.ships = [G.player];
  G.auto = [false,false,false,false,false]; G.aimAuto = false; G.mouse.has = true; G.fireHeld = true; G.aimJoy = {x0:0, y0:0, x:0, y:-50};
  G.player.guns = G.player.guns.filter(g => g.t!=='core');
  G.player.enMax = 1e6;
}
const SECS = 12;
// a hulk of plain hull, w x h blocks, as tough as a mid-run enemy's, straight ahead at dist
function hulk(dist, w, h){
  const m = new Map();
  for (let i=-w; i<=w; i++) for (let j=-h; j<=h; j++) m.set(K(i,j), i||j ? 'hull' : 'core');
  const p = G.player, e = makeShip(m, 'e', p.x, p.y - dist, 2.5);
  e.station = true; e.spin = 0; e.guns = []; e.bays = []; e.shields = []; e.epd = []; e.sc = G.SC; e.value = 0; e.n0 = m.size;
  G.ships.push(e); return e;
}
// damage per second at 30%, 60% and 90% of range: on a held trigger against a big still hulk,
// or on auto fire against a small hulk weaving side to side (turrets track it, fixed weapons and slow shots struggle)
function measured(t, moving){
  const R = rangeOf(t)*G.SC; let sum = 0;
  for (const f of [.3, .6, .9]){
    fresh(); armed(t);
    if (moving){ G.auto = [true,true,true,true,true]; G.fireHeld = false; G.aimJoy = null; }
    // mines only drift a few metres: they get their target close, wherever the others stand
    const dist = t==='mine' ? 70 : Math.max(R*f, 40), e = moving ? hulk(dist + BS, 2, 1) : hulk(dist + 4*BS, 6, 4), x0 = e.x;
    sim(SECS, () => false, tt => {
      G.player.en = 1e6;
      if (moving){ const sw = 140*G.SC, w = .9; e.x = x0 + Math.sin(tt*w)*sw; e.vx = Math.cos(tt*w)*sw*w; }
    });
    sum += (e.lifeMax - e.life)/SECS;
  }
  return sum/3;
}
const rows = [];
for (const t of LIST){
  const d = T[t], g = d.gun, P = PARTS[t], cells = P ? partOffsets(P).length : 1;
  const hp = (d.hp || 0) + (P ? (T[P.body].hp || 0)*(cells - 1) : 0), mass = (d.mass || 0) + (P ? (T[P.body].mass || 0)*(cells - 1) : 0);
  const range = rangeOf(t);
  const arc = g ? cpArc(g.arc ?? Math.PI) : d.laser ? (d.laser.arc || SWING) : d.rail ? SWING : Math.PI;
  const en = g ? (g.en || 0)/g.cd : d.laser ? d.laser.en : d.rail ? d.rail.en/d.rail.cd : d.tesla ? d.tesla.en/d.tesla.cd : 0;
  const listed = g ? g.dmg*(g.pellets || 1)*(g.mirv || 1)/g.cd : d.laser ? d.laser.dps : d.rail ? d.rail.pool/d.rail.cd : d.tesla ? d.tesla.dmg*d.tesla.jumps/d.tesla.cd : 0;
  // fires over its own hull: it can sit buried inside the ship, out of harm's way
  const over = !!(g && (g.over || g.homing || g.lob)) || !!d.tesla;
  // enemy point defense shoots down guided rounds
  const pdStop = !!(g && g.homing);
  const big = measured(t, false), mov = measured(t, true), dps = .6*big + .4*mov;
  const F = {
    range: range/300,                                  // reach, in full: out-ranging a foe lets you hit it from where it can't hit back
    arc: .4 + .6*Math.min(1, arc/Math.PI),               // a full circle of fire is worth 2.5x a fixed forward line
    over: over ? 1.35 : 1,                               // can be protected inside the hull
    pd: pdStop ? .85 : 1,                                // can be shot down
    hp: Math.pow(hp/cells/20, .25),                      // tougher per cell lasts longer in a fight
    en: 1/(1 + en/8),                                    // every 8 energy/s is a generator to carry
    size: 1/(1 + .15*(cells - 1)),                       // room on the hull
    mass: 1/(1 + .04*mass),                              // weight slows the ship
  };
  const value = dps*Object.values(F).reduce((a,b) => a*b, 1);
  rows.push({t, d, cost:d.cost, listed, big, mov, dps, range, arc, en, cells, hp, mass, over, pdStop, F, value, per:d.cost/Math.max(.01, value)});
}
const med = [...rows].map(r => r.per).sort((a,b) => a-b)[Math.floor(rows.length/2)];
const f1 = (v, n) => v.toFixed(1).padStart(n), f2 = (v, n) => v.toFixed(2).padStart(n), st = (v, n) => String(v).padStart(n);
log('STATS');
log('weapon      rar unl  cost cells  mass   hp   range  arc°  over  pd-stop  en/s  listed  big-dps  moving-dps  en/dps');
for (const r of rows) log(`${r.t.padEnd(10)} ${st(RARITY[rarOf(r.t)].name.slice(0,3),4)} ${st(r.d.unlock,3)} ${st(r.cost,5)} ${st(r.cells,5)} ${f1(r.mass,5)} ${st(r.hp,4)} ${st(r.range,7)} ${st(Math.round(r.arc*180/Math.PI),5)}  ${(r.over ? 'yes' : 'no').padStart(4)}  ${(r.pdStop ? 'yes' : 'no').padStart(7)} ${f1(r.en,5)} ${f1(r.listed,7)} ${f1(r.big,8)} ${f1(r.mov,11)} ${f2(r.en/Math.max(.01, r.dps),7)}`);
log('');
log('VALUE FACTORS (value = 0.6 big + 0.4 moving dps, times every factor), cheapest for what it does first');
log('weapon      range   arc  over    pd    hp    en  size  mass   value  cr/value  vs median');
for (const r of [...rows].sort((a,b) => a.per - b.per)) log(`${r.t.padEnd(10)} ${['range','arc','over','pd','hp','en','size','mass'].map(k => f2(r.F[k],5)).join(' ')} ${f1(r.value,7)} ${f1(r.per,9)} ${f2(r.per/med,7)}x`);
// every weapon is held to the band, support and utility ones too, so the report shows where each one stands
for (const r of rows) ok(`${r.t}: price in line with value`, r.per >= med/2 && r.per <= med*2, `${(r.per/med).toFixed(2)}x the median credits per value`);
