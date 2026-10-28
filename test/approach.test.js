// Enemy AI: a ship circling too far out to fire closes in until its guns reach, then eases back out.
fresh(); G.stage = 3;
G.design = new Map([[CORE,'core']]); G.dirs = new Map();
for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) if (i || j) G.design.set(K(i,j), 'hull');
startFight('fight'); G.waves = []; G.ships = [G.player];
const p = G.player, far = 1600*G.SC;
const des = new Map([[CORE,'core'], [K(0,-1),'cannon'], [K(-1,0),'hull'], [K(1,0),'hull'], [K(0,1),'engine'], [K(1,1),'engine'], [K(-1,1),'gyro']]);
const e = makeShip(des, 'e', p.x, p.y - far, 1, gunDirs(des));
e.sc = G.SC; e.ft = 3; e.phase = 0; e.spin = 1; e.orb = -Math.PI/2; e.orbSpd = .3; e.pref = far; e.vmax = 1; e.n0 = des.size;
for (const b of e.blocks.values()) b.hp = b.max = 1e6;
e.life = e.lifeMax = 1e7;
G.ships.push(e);
const t0 = G.time;
sim(3, () => false, () => { p.vx = p.vy = 0; p.x = G.AW/2; p.y = G.AH/2; });
ok('circling far out, it does not fire', (e.shotAt || 0) < t0 + .2, e.shotAt);
sim(40, () => (e.shotAt || 0) > t0 + 1, () => { p.vx = p.vy = 0; p.x = G.AW/2; p.y = G.AH/2; });
ok('after a while without firing, it closes in and fires', (e.shotAt || 0) > t0 + 1, `closed ${(e.close || 0).toFixed(2)}, ${Math.round(Math.hypot(e.x-p.x, e.y-p.y)/G.SC)} away`);
