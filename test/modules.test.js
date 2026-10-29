// Support modules boost the weapons they touch, corners included, at a cost in energy; upgrade levels add range.
fresh(); G.stage = 6;
G.design = new Map([[CORE,'core'], [K(0,-2),'cannon'], [K(1,-2),'rmod'], [K(-1,-1),'dmod'], [K(2,2),'cmod']]); G.dirs = new Map();
for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) if (!G.design.has(K(i,j))) G.design.set(K(i,j), 'hull');
startFight('fight'); G.waves = []; G.ships = [G.player];
const p = G.player, g = p.guns.find(b => b.t==='cannon');
const B = boost(p, g);
ok('a side and a corner module both count', Math.abs(B.rng - 1.2) < 1e-9 && Math.abs(B.dmg - 1.2) < 1e-9, JSON.stringify(B));
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
ok('the shell hits 20% harder', shell && Math.abs(shell.dmg - T.cannon.gun.dmg*LV('cannon')*HM.dmg()*1.2) < 1e-6, shell && shell.dmg);
// levels: +10% range each
G.lv.cannon = 3;
ok('level 3 reaches 20% further', Math.abs(rangeMul('cannon') - 1.2*cockpit().range) < 1e-9, rangeMul('cannon'));
ok('the shop says what the next level does', /damage.*\+10% range.*hit points/.test(lvGain('cannon')), lvGain('cannon'));
ok('the inspector says what levels added', /\+70% damage, \+20% range/.test(lvHave('cannon')), lvHave('cannon'));
ok('modules are in the palette', ['rmod','dmod','cmod'].every(t => PAL.includes(t)));
