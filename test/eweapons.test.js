// Every player weapon but torpedoes and mines has an enemy version: each one, on a tough enemy hull held still in front
// of the player, gets a shot off that hurts. Enemies carry a weapon from the sector that unlocks it.
const kinds = Object.keys(EW), weapon = t => t!=='core' && t!=='torpedo' && t!=='mine' && (T[t].gun || T[t].laser || T[t].rail || T[t].tesla);
ok('every player weapon has an enemy version', Object.keys(BLOCKS).filter(weapon).every(t => EW[t]), Object.keys(BLOCKS).filter(t => weapon(t) && !EW[t]).join(', '));
ok('no enemy torpedoes or mines', !EW.torpedo && !EW.mine);
for (const k of kinds){
  fresh(); G.stage = 12;
  G.design = new Map([[CORE,'core']]); G.dirs = new Map();
  for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) if (i || j) G.design.set(K(i,j), 'hull');
  startFight('fight'); G.waves = []; G.ships = [G.player];
  const p = G.player, d = Math.min(EW[k].range*.45, 400)*G.SC + p.r;
  const des = new Map([[CORE,'core'], [K(0,-1), k], [K(-1,0),'hull'], [K(1,0),'hull'], [K(0,1),'hull']]);
  const e = makeShip(des, 'e', p.x, p.y - d, 1, gunDirs(des));
  e.sc = G.SC; e.ft = 3; e.phase = 0; e.spin = 1; e.orb = 0; e.orbSpd = 0; e.pref = d; e.vmax = 0; e.n0 = des.size;
  e.a = Math.atan2(p.x-e.x, -(p.y-e.y)); e.c = Math.cos(e.a); e.sn = Math.sin(e.a);
  for (const b of e.blocks.values()) b.hp = b.max = 1e6;
  e.life = e.lifeMax = 1e7;
  G.ships.push(e);
  const life0 = p.life;
  let threw = '';
  try { sim(25, () => p.life < life0 - 1, () => { p.vx = p.vy = 0; e.vx = e.vy = 0; e.x = p.x; e.y = p.y - d; }); } catch (err){ threw = String(err); }
  ok(`enemy ${k} fires without errors`, !threw, threw);
  ok(`enemy ${k} hurts the player`, p.life < life0 - 1, `life ${p.life.toFixed(1)} of ${life0.toFixed(1)}`);
}
fresh();
const seen = s => { const got = new Set(); for (let n=0; n<3000; n++) got.add(pickWeapon(s)); return got; };
const s1 = seen(1);
ok('sector 1 enemies carry only starting weapons', [...s1].every(k => (T[k].unlock || 1) <= 1), [...s1].join(', '));
for (const k of kinds){
  const u = T[k].unlock || 1;
  if (u > 1) ok(`${k} (unlocks in sector ${u}) first carried there`, !seen(u-1).has(k) && seen(u).has(k));
}
ok('late sectors carry every weapon', seen(30).size === kinds.length);
