// Runs ahead of each test inside `with (OOM)`: every module export is in scope, so tests call the game's functions directly.
// Module bindings can't be reassigned from here; change game state through G or the game's own functions.
const __checks = [], __logs = [];
const ok = (name, pass, msg='') => { __checks.push({name, pass:!!pass, msg:String(msg)}); };
const __fail = (name, msg) => ok(name, false, msg);
const log = (...a) => __logs.push(a.join(' '));
const __finish = () => console.log('TESTRESULT ' + JSON.stringify({checks:__checks, logs:__logs}));
// a clean run: no saves, no hangar upgrades, no tutorial tips
function fresh(stage=1){
  try { localStorage.clear(); } catch {}
  $('tutSkip').click(); // no tutorial tips
  G.meta = {data:0, lv:{}}; newRun();
  if (stage > 1){ G.stage = stage; G.map = genMap(stage); G.node = G.map.nodes[1]; }
}
// run the fight loop for up to `sec` seconds of game time (30 steps a second); stops early when `until()` is true
function sim(sec, until=() => false, each=null){
  let t = 0;
  while (t < sec && G.mode==='combat' && !until()){ update(1/30); if (each) each(t); t += 1/30; }
  return t;
}
// a still, gunless enemy target with plenty of armour: a 7×3 wall facing the player, centred d straight ahead of its nose
function dummy(d, hp=40){
  const m = new Map();
  for (let i=-3; i<=3; i++) for (let l=-1; l<=1; l++) m.set(K(i,0,l), i||l ? 'armor' : 'core');
  const p = G.player, at = p.p.clone().add(toWorld(p, DIRV[0]).multiplyScalar(d));
  const e = makeShip(m, 'e', at, hp);
  e.station = true; e.spin = 0; e.guns = []; e.bays = []; e.shields = []; e.epd = []; e.sc = G.SC; e.value = 0; e.n0 = m.size;
  G.ships.push(e); return e;
}
// the mouse at the middle of the screen, so mouse steering holds the ship still
const centreMouse = () => { G.mouse = {x: W/2, y: H/2, has: true}; };
const hpLost = s => { let lost = 0; for (const b of s.blocks.values()) lost += b.max - b.hp; return lost + (s.n0 - s.blocks.size)*100; };
// three.js's vector class, borrowed from a vector the game already holds
const THREE_Vector3 = G.aim.constructor;
