// Weapon balance rules: slow shots reach far, fast shots stay short unless they cost a lot of energy,
// and no weapon delivers far more damage-at-range per point of energy than the rest.
const rows = [];
for (const t of PAL){
  const d = T[t];
  let dps, en, spd, range = rangeOf(t);
  if (d.gun){ const g = d.gun; dps = g.dmg*(g.pellets || 1)*(g.mirv || 1)/g.cd; en = (g.en || 0)/g.cd; spd = g.spd; }
  else if (d.laser){ dps = d.laser.dps*.6; en = d.laser.en; spd = Infinity; }
  else if (d.rail){ dps = d.rail.pool/d.rail.cd; en = d.rail.en/d.rail.cd; spd = Infinity; }
  else if (d.tesla){ dps = d.tesla.dmg*d.tesla.jumps/d.tesla.cd; en = d.tesla.en/d.tesla.cd; spd = Infinity; }
  else continue;
  const reach = dps*range/1000, eff = reach/Math.max(1, en);
  rows.push({t, dps, en, spd, range, reach, eff, lob:d.gun && d.gun.lob, homing:d.gun && d.gun.homing});
}
log('weapon      dps   en/s  speed  range  reach  per-energy');
for (const r of rows) log(`${r.t.padEnd(10)} ${r.dps.toFixed(1).padStart(5)} ${r.en.toFixed(1).padStart(6)} ${String(r.spd===Infinity ? 'beam' : r.spd).padStart(6)} ${String(r.range).padStart(6)} ${r.reach.toFixed(1).padStart(6)} ${r.eff.toFixed(2).padStart(8)}`);

for (const r of rows){
  ok(`${r.t} has a range`, r.range > 0);
  if (r.lob) continue;
  // fast or instant and long-ranged: must be expensive to run
  if (r.spd >= 600 && r.range > 300) ok(`${r.t}: fast and long-ranged costs energy`, r.en >= 12, `${r.en.toFixed(1)} energy/s`);
  // slow projectiles get the long reach
  if (r.spd <= 250) ok(`${r.t}: slow shot reaches far`, r.range >= 700, `range ${r.range}`);
  ok(`${r.t}: damage-at-range per energy in band`, r.eff <= 4.5, r.eff.toFixed(2));
}
// fast guns may not outrange slower ones of the same family
// (pellet guns are short by their spread, not their speed, so they sit outside this rule)
const direct = rows.filter(r => !r.homing && !r.lob && r.spd !== Infinity && !T[r.t].gun.pellets).sort((a,b) => a.spd - b.spd);
for (let n=1; n<direct.length; n++) ok(`${direct[n].t} (faster) does not outrange ${direct[n-1].t}`, direct[n].range <= direct[n-1].range + 1e-9 || direct[n].spd === direct[n-1].spd, `${direct[n].range} vs ${direct[n-1].range}`);
