// Cockpits: each brings its own core gun and right-click ability; the interceptor's edge depends on ship size.
fresh(); G.meta.best = 9;
const turret = K(0,-1);
function fight(cp){
  G.cockpit = cp; G.design = new Map([[CORE,'core'],[turret,'cannon'],[K(0,1),'engine']]); G.dirs = new Map([[turret,0],[K(0,1),0]]);
  startFight('fight'); G.waves = []; G.ships = [G.player];
  G.mouse.has = true; G.fireHeld = false; G.aimAuto = false; for (const k in keys) keys[k] = false;
}
// standard: Jump warps the ship toward the mouse, then cools down
fight('std');
ok('the standard core gun is the cyan tracer', T.core.gun.dmg === 4);
const p = G.player, x0 = p.x, y0 = p.y;
G.mouse.x = W/2 + 200; G.mouse.y = H/2; G.abReq = true; sim(.1);
ok('Jump moves the ship toward the mouse', p.x - x0 > 100*G.SC && Math.abs(p.y - y0) < 20*G.SC, `${Math.round(p.x - x0)}, ${Math.round(p.y - y0)}`);
ok('Jump goes on cooldown', G.abT > 7);
const x1 = p.x; G.abReq = true; sim(.1);
ok('no second jump while cooling down', Math.abs(p.x - x1) < 30*G.SC);
// interceptor: twin guns, a roll that makes the ship untouchable for a moment, and a size-based edge
fight('fighter');
ok('the interceptor core fires twin rounds', T.core.gun.pellets === 2);
ok('a 3-block interceptor gets its full edge', smallK() === 1);
const q = G.player, core = q.blocks.get(CORE), hp0 = core.hp;
damage(q, CORE, 10);
ok('a small interceptor takes 40% less damage', Math.abs(hp0 - core.hp - 6) < 1e-6, hp0 - core.hp);
G.abReq = true; sim(.1);
const hp1 = core.hp; damage(q, CORE, 10);
ok('mid-roll nothing gets through', core.hp === hp1);
const big = new Map([[CORE,'core']]); for (let i=-3; i<=3; i++) for (let j=1; j<=6; j++) big.set(K(i,j),'hull');
G.design = big;
ok('a 43-block interceptor has lost its edge', smallK() === 0, blockCount());
