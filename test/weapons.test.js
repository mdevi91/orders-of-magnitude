// Every weapon hits a target inside its range and holds fire at one beyond it; shots fade with distance.
const W = ['cannon','gatling','scatter','flak','ion','missile','mirv','torpedo','mine','laser','rail','tesla'];
function armed(t){
  // the weapon straight ahead of the core (multi-cell parts trail back to it), two generators and a battery for energy
  const len = PARTS[t] ? PARTS[t].len : 1, d = new Map([[CORE,'core'],[K(-1,0),'gen'],[K(1,0),'gen'],[K(0,1),'battery']]);
  for (const [i,j,l,ct] of cellsFor(0,-len,0,t,0)) d.set(K(i,j,l), ct);
  G.design = d; G.dirs = new Map([[K(0,-len),0]]); G.broken = new Set();
  startFight('fight'); G.waves = []; G.ships = [G.player];
  // manual fire, aimed dead ahead (auto-aim's deliberate wobble would make slow shots miss a small target)
  G.auto = [false,false,false,false,false]; G.aimAuto = false; centreMouse(); G.fireHeld = true;
  G.aimAt = G.player.p.clone().add(new THREE_Vector3(0,0,-1000));
  G.player.guns = G.player.guns.filter(g => g.t!=='core'); // the core's own gun would muddy the result
}
for (const t of W){
  const R = rangeOf(t)*G.SC;
  fresh(); armed(t);
  // mines only drift a few metres, so they are tested with the target almost on top of them
  const near = dummy(t==='mine' ? 70 : R*.6 + 25);
  sim(8);
  ok(`${t} hits inside range`, hpLost(near) > 0, `range ${Math.round(R)}, damage ${Math.round(hpLost(near))}`);
  fresh(); armed(t);
  const far = dummy(R*1.4 + 70);
  sim(8);
  ok(`${t} holds fire beyond range`, hpLost(far) === 0 && !G.pb.length, `damage ${Math.round(hpLost(far))}, shots in flight ${G.pb.length}`);
}
// falloff: full damage over the first half of the flight, half at the very end
const b = {fall:true, life0:1};
ok('falloff', [[1,1],[.5,1],[.25,.75],[0,.5]].every(([life,want]) => Math.abs(fallOff({...b, life}) - want) < 1e-9));
ok('homing shots never fade', fallOff({fall:false, life0:1, life:0}) === 1);
// every weapon also works on auto fire, with no player input (an auto laser used to throw and freeze the fight)
for (const t of W){
  const R = rangeOf(t)*G.SC;
  fresh(); armed(t);
  G.auto = [true,true,true,true,true]; G.fireHeld = false; G.aimAt = null; centreMouse();
  const e = dummy(t==='mine' ? 70 : R*.6 + 25);
  sim(8);
  ok(`${t} hits on auto fire`, hpLost(e) > 0, `damage ${Math.round(hpLost(e))}`);
}
