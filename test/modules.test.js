// Support modules boost the weapons they touch, corners included, at a cost in energy, split between the weapons sharing
// them; upgrade levels add range.
fresh(); G.stage = 6;
G.design = new Map([[CORE,'core'], [K(0,-2),'cannon'], [K(1,-2),'rmod'], [K(-1,-1),'dmod'], [K(2,2),'cmod']]); G.dirs = new Map();
for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) if (!G.design.has(K(i,j))) G.design.set(K(i,j), 'hull');
startFight('fight'); G.waves = []; G.ships = [G.player];
const p = G.player, g = p.guns.find(b => b.t==='cannon');
const B = boost(p, g);
ok('a side and a corner module both count', Math.abs(B.rng - 1.4) < 1e-9 && Math.abs(B.dmg - 1.4) < 1e-9, JSON.stringify(B));
ok('a module out of touch does nothing', B.rate === 1, B.rate);
ok('each module costs 30% more energy per shot', Math.abs(B.en - 1.6) < 1e-9, B.en);
// the boost goes once its module is shot off
p.blocks.delete(K(1,-2));
ok('losing a module loses its boost', Math.abs(boost(p, g).rng - 1) < 1e-9, boost(p, g).rng);
// a fired shell carries the damage boost, and the shot cost more energy
const des = new Map([[CORE,'core']]), e = makeShip(des, 'e', p.x, p.y - 200*G.SC, 1, gunDirs(des));
e.sc = G.SC; e.vmax = 0; e.n0 = 1; e.life = e.lifeMax = 1e9; for (const b of e.blocks.values()) b.hp = b.max = 1e9; G.ships.push(e);
p.en = p.enMax = 1e4; let shell = null;
sim(3, () => !!shell, () => { p.vx = p.vy = 0; p.a = 0; e.x = p.x; e.y = p.y - 200*G.SC; shell = shell || G.pb.find(b => b.kind==='oval'); });
ok('the shell hits 40% harder', shell && Math.abs(shell.dmg - T.cannon.gun.dmg*LV('cannon')*HM.dmg()*1.4) < 1e-6, shell && shell.dmg);
// levels: +10% range each
G.lv.cannon = 3;
ok('level 3 reaches 20% further', Math.abs(rangeMul('cannon') - 1.2*cockpit().range) < 1e-9, rangeMul('cannon'));
ok('the shop says what the next level does', /damage.*\+10% range.*hit points/.test(lvGain('cannon')), lvGain('cannon'));
ok('the inspector says what levels added', /\+70% damage, \+20% range/.test(lvHave('cannon')), lvHave('cannon'));
ok('modules are in the palette', ['rmod','dmod','cmod'].every(t => PAL.includes(t)));
// shared modules: split evenly, each module once per weapon; a lost weapon's share goes back to the others
fresh(); G.stage = 6;
G.design = new Map([[CORE,'core'], [K(-1,-3),'cannon'], [K(0,-3),'dmod'], [K(1,-3),'cannon'], [K(0,-2),'hull'], [K(0,-1),'hull'], [K(-1,-2),'hull'], [K(1,-2),'hull'], [K(2,-3),'cmod']]);
G.dirs = new Map(); G.broken = new Set(); G.mnt = {}; G.ang = {};
startFight('fight'); G.waves = []; G.ships = [G.player];
{
  const P = G.player, a = P.blocks.get(K(-1,-3)), b = P.blocks.get(K(1,-3));
  ok('two weapons split a module', Math.abs(boost(P,a).dmg - 1.2) < 1e-9 && Math.abs(boost(P,a).en - 1.15) < 1e-9, JSON.stringify(boost(P,a)));
  ok('a module one weapon has alone gives all of it', Math.abs(boost(P,b).rate - 1.4) < 1e-9 && Math.abs(boost(P,b).en - 1.45) < 1e-9, JSON.stringify(boost(P,b)));
  P.blocks.delete(K(-1,-3));
  ok('its share goes back when the other weapon is lost', Math.abs(boost(P,b).dmg - 1.4) < 1e-9, JSON.stringify(boost(P,b)));
  const f = designFeeds().find(q => q.k===K(1,-3));
  ok('the drydock works it out the same', f && Math.abs(f.B.dmg - 1.2) < 1e-9 && Math.abs(f.B.rate - 1.4) < 1e-9, f && JSON.stringify(f.B));
}
// a multi-cell weapon counts once however many of its cells touch the module
G.design = new Map([[CORE,'core'], [K(0,-3),'laser'], [K(1,-3),'dmod'], [K(0,-1),'hull']]); for (const [i,j,ct] of cellsFor(0,-3,'laser',0)) G.design.set(K(i,j), ct);
G.dirs = new Map([[K(0,-3),0], [K(0,-2),0]]);
{ const f = designFeeds().find(q => q.k===K(0,-3)); ok('a long weapon is one share', f && Math.abs(f.B.dmg - 1.4) < 1e-9, f && JSON.stringify(f.B)); }
// the cockpit gun takes no share
G.design = new Map([[CORE,'core'], [K(0,-1),'dmod'], [K(0,-2),'cannon']]); G.dirs = new Map();
{ const f = designFeeds(); ok('the cockpit gun neither takes a share nor gets boosted', f.length===1 && f[0].t==='cannon' && Math.abs(f[0].B.dmg - 1.4) < 1e-9, JSON.stringify(f.map(q => [q.t, q.B]))); }
// punching through: leftovers carry on along the shot, armour soaks more, nothing goes further than the damage does
function wall(types){
  fresh(); G.stage = 6; const m = new Map([[CORE,'core']]); types.forEach((t,n) => m.set(K(0,-1-n), t));
  G.design = new Map([[CORE,'core'], [K(0,1),'hull']]); G.dirs = new Map(); G.broken = new Set(); G.mnt = {}; G.ang = {};
  startFight('fight'); G.waves = []; G.ships = [G.player];
  const e = makeShip(m, 'e', 500, 500, 1); e.station = true; e.spin = 0; e.guns = []; e.bays = []; e.shields = []; e.epd = []; e.sc = G.SC; e.a = 0; e.c = 1; e.sn = 0; e.n0 = m.size; G.ships.push(e); return e;
}
{
  const e = wall(['hull','hull','hull','hull']), hp = e.blocks.get(K(0,-4)).max, front = K(0,-4), y0 = wpos(e, e.blocks.get(front))[1];
  punch(e, front, hp*.5, 500, y0, 0, 1);
  ok('a shot that does not break a block stops there', e.blocks.get(front).hp === hp*.5 && e.blocks.get(K(0,-3)).hp === hp, e.blocks.get(front)?.hp);
  const e2 = wall(['hull','hull','hull','hull']), hp2 = e2.blocks.get(K(0,-4)).max, life = e2.life;
  punch(e2, K(0,-4), hp2*1.5, 500, wpos(e2, e2.blocks.get(K(0,-4)))[1], 0, 1);
  ok('a big hit breaks the block and its leftover lands behind it', !e2.blocks.has(K(0,-4)) && Math.abs(e2.blocks.get(K(0,-3)).hp - hp2*.5) < 1e-6 && e2.blocks.get(K(0,-2)).hp === hp2, e2.blocks.get(K(0,-3))?.hp);
  ok('all of the damage counts', Math.abs(life - e2.life - hp2*1.5) < 1e-6, life - e2.life);
  const e3 = wall(['hull','hull','armor','hull']), hp3 = e3.blocks.get(K(0,-4)).max, arm = e3.blocks.get(K(0,-3)).max;
  punch(e3, K(0,-4), hp3 + arm*.5/(1 - ARMOR_DR), 500, wpos(e3, e3.blocks.get(K(0,-4)))[1], 0, 1);
  ok('armour takes its usual cut of the leftover', Math.abs(e3.blocks.get(K(0,-3)).hp - arm*.5) < 1e-6, e3.blocks.get(K(0,-3))?.hp);
}
// a burst's overkill spills onto the nearest blocks left
{
  const e = wall(['hull','hull','hull','hull']), hp = e.blocks.get(K(0,-4)).max, [x,y] = wpos(e, e.blocks.get(K(0,-4)));
  flakBurst({x, y, dmg:hp*1.5, blast:4});
  ok('a burst spills what it wastes', !e.blocks.has(K(0,-4)) && Math.abs(e.blocks.get(K(0,-3)).hp - hp*.5 - hp*.0) < hp*.1, e.blocks.get(K(0,-3))?.hp);
}
