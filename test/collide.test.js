// Collisions: hulls bounce apart, a gentle bump does no harm, and a heavier ship hits harder.
function crash(n, speed){
  fresh(6);
  // a big slab of hull for the player, so no hit can wreck it outright
  G.design = new Map([[CORE, 'core']]); for (let i=-4; i<=4; i++) for (let j=-4; j<=4; j++) if (i || j) G.design.set(K(i,j), 'armor');
  startFight('fight');
  G.ships = G.ships.filter(s => s.team === 'p');
  const p = G.player;
  const e = makeShip(genDesign(n, false, 6), 'e', 0, 0, 1, null);
  e.vmax = 1; e.warp = 0; e.ph = physics(e.blocks.values(), k => e.blocks.get(k)?.t, false); G.ships.push(e);
  // just touching: the enemy's nearest block a little inside the player's hull, closing at the given speed
  e.x = p.x; e.y = p.y - p.r - e.r;
  for (let i=0; i<400 && !collideTouch(p, e); i++) e.y += 1;
  p.vx = p.vy = 0; e.vx = 0; e.vy = speed*G.SC;
  const lp0 = p.life, le0 = e.life, v0 = e.vy;
  collide(p, e);
  return {p: lp0 - p.life, e: le0 - e.life, bounced: e.vy < v0 && p.vy > 0, evy: e.vy, v0, pvy: p.vy, ex: e.x - p.x, ey: e.y - p.y, r: p.r + e.r};
}
function collideTouch(p, e){
  for (const b of e.blocks.values()){ const [x, y] = wpos(e, b); if (hitShip(p, x, y, BS*.45) >= 0) return true; }
  return false;
}
const soft = crash(30, 15);
ok('a gentle bump does no damage', soft.p === 0 && soft.e === 0, `player lost ${soft.p.toFixed(1)}`);
ok('hulls bounce apart', soft.bounced, JSON.stringify(soft));
const small = crash(30, 220), big = crash(400, 220);
ok('a hard hit damages both hulls', small.p > 0 && small.e > 0, `player ${small.p.toFixed(1)}, enemy ${small.e.toFixed(1)}`);
ok('a heavier ship hits harder', big.p > small.p*1.5, `heavy ${big.p.toFixed(1)} vs light ${small.p.toFixed(1)}`);
