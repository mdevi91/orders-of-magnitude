// Battle hazards: each one starts a few seconds into the fight, runs without errors and does what it says.
const setup = () => {
  fresh(); G.stage = 4;
  G.design = new Map([[CORE,'core'], [K(1,1),'shield']]); G.dirs = new Map();
  for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) if ((i || j) && !G.design.has(K(i,j))) G.design.set(K(i,j), 'hull');
  startFight('fight'); G.waves = []; G.ships = [G.player];
  const p = G.player; p.life = p.lifeMax = 1e7; for (const b of p.blocks.values()) b.hp = b.max = 1e6;
  // a harmless enemy far away keeps the fight going
  const des = new Map([[CORE,'core']]), e = makeShip(des, 'e', 50, 50, 1, gunDirs(des));
  e.sc = G.SC; e.vmax = 0; e.n0 = 1; e.life = e.lifeMax = 1e9; for (const b of e.blocks.values()) b.hp = b.max = 1e9; G.ships.push(e);
  return p;
};
const hold = p => () => { p.vx = p.vy = 0; p.x = G.AW/2; p.y = G.AH/2; };
let p = setup();
ok('no hazard rolls by itself in the test build', G.hz === null);
for (const kind of Object.keys(HAZARDS)){
  p = setup(); startHazard(kind);
  let threw = '', saw = {rock:0, jam:0, pop:0};
  const life0 = p.life;
  // rocks are aimed at the ship so the hail can't miss it by chance
  const aim = () => { if (G.hz.on) for (const R of G.hz.rocks) if (!R.aimed){ R.aimed = true; const v = Math.hypot(R.vx, R.vy), a = Math.atan2(p.y-R.y, p.x-R.x); R.vx = Math.cos(a)*v; R.vy = Math.sin(a)*v; } };
  // lightning lands at random around the ship, so for the test every roll comes up even and strikes dead centre
  const rnd = Math.random; if (kind==='storm') Math.random = () => .5;
  try { sim(30, () => false, () => { hold(p)(); aim(); saw.rock = Math.max(saw.rock, G.hz.rocks.length); if ([...p.blocks.values()].some(b => (b.jam || 0) > G.time)) saw.jam++; const B = p.shields[0]?.bub; if (B && B.down > 0) saw.pop++; }); } catch (e){ threw = String(e); }
  Math.random = rnd;
  ok(`${kind}: runs without errors`, !threw, threw);
  ok(`${kind}: announced`, G.hz.on);
  if (kind==='rocks') ok('rocks fly and hit the ship', saw.rock > 3 && p.life < life0, `${saw.rock} rocks, life lost ${(life0 - p.life).toFixed(1)}`);
  if (kind==='storm') ok('lightning jams weapons', saw.jam > 0 || p.life < life0, `${saw.jam} jammed frames`);
  if (kind==='flare') ok('a flare pops shields', saw.pop > 0, saw.pop);
}
