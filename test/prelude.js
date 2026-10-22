// Injected into the game's scope ahead of each test. Tests call these helpers and the game's own functions directly.
const __checks = [], __logs = [];
const ok = (name, pass, msg='') => { __checks.push({name, pass:!!pass, msg:String(msg)}); };
const __fail = (name, msg) => ok(name, false, msg);
const log = (...a) => __logs.push(a.join(' '));
const __finish = () => console.log('TESTRESULT ' + JSON.stringify({checks:__checks, logs:__logs}));
// a clean run: no saves, no hangar upgrades, no tutorial tips
function fresh(stage=1){
  try { localStorage.clear(); } catch {}
  tutOff = true; tutQ = []; $('tut').hidden = true;
  G.meta = {data:0, lv:{}}; newRun();
  if (stage > 1){ G.stage = stage; G.map = genMap(stage); G.node = G.map.nodes[1]; }
}
// run the fight loop for up to `sec` seconds of game time (30 steps a second); stops early when `until()` is true
function sim(sec, until=() => false, each=null){
  let t = 0;
  while (t < sec && G.mode==='combat' && !until()){ update(1/30); if (each) each(t); t += 1/30; }
  return t;
}
// a still, gunless enemy target with plenty of armour, centred at distance d straight ahead of the player
function dummy(d, hp=40){
  const m = new Map();
  for (let i=-3; i<=3; i++) for (let j=-1; j<=1; j++) m.set(K(i,j), i||j ? 'armor' : 'core');
  const p = G.player, e = makeShip(m, 'e', p.x, p.y - d, hp);
  e.station = true; e.spin = 0; e.guns = []; e.bays = []; e.shields = []; e.epd = []; e.sc = G.SC; e.value = 0; e.n0 = m.size;
  G.ships.push(e); return e;
}
const hpLost = s => { let lost = 0; for (const b of s.blocks.values()) lost += b.max - b.hp; return lost + (s.n0 - s.blocks.size)*100; };
