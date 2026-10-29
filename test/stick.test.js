// Goo and hacking modules stick to the hull they hit and slow it: goo its flying and turning, a hacking module its
// flying, reloads and generators too. Both wear off, and both work from either side.
fresh(); G.stage = 6;
G.design = new Map([[CORE,'core']]); G.dirs = new Map();
for (let i=-2; i<=2; i++) for (let j=-2; j<=2; j++) if (i || j) G.design.set(K(i,j), 'hull');
startFight('fight'); G.waves = []; G.ships = [G.player];
const p = G.player;
const des = new Map([[CORE,'core'], [K(0,-1),'cannon'], [K(-1,0),'hull'], [K(1,0),'hull'], [K(0,1),'engine']]);
const e = makeShip(des, 'e', p.x, p.y - 300*G.SC, 1, gunDirs(des));
e.sc = G.SC; e.n0 = des.size; G.ships.push(e);
ok('nothing stuck, no slowdown', JSON.stringify(drag(e)) === JSON.stringify({move:1, fire:1, gen:1}));
for (let n=0; n<6; n++) stick(e, CORE, e.x, e.y, 'goo');
const g6 = drag(e);
ok('six goo blobs take 30% off speed, not reload', Math.abs(g6.move - .7) < 1e-9 && g6.fire === 1, JSON.stringify(g6));
for (let n=0; n<40; n++) stick(e, CORE, e.x, e.y, 'goo');
ok('goo caps out at under half speed', drag(e).move >= .45 && e.stuck.length <= STICK.goo.max, drag(e).move);
e.stuck = [];
for (let n=0; n<5; n++) stick(e, K(1,0), e.x, e.y, 'hack');
const h3 = drag(e);
ok('hacking modules stack to 3', e.stuck.length === 3, e.stuck.length);
ok('three modules: slower flying, reloads and generators', h3.move < .6 && Math.abs(h3.fire - .25) < 1e-9 && Math.abs(h3.gen - .1) < 1e-9, JSON.stringify(h3));
G.time += STICK.hack.t + 1;
ok('they wear off', drag(e).fire === 1 && e.stuck.length === 0);
stick(e, K(1,0), e.x, e.y, 'hack'); e.blocks.delete(K(1,0));
ok('shooting off the block drops what clings to it', drag(e).fire === 1);
// player rounds stick on a hit
e.stuck = [];
const b = {x:e.x, y:e.y, vx:0, vy:-1, sp:1, r:1, dmg:.01, life:1, life0:1, kind:'goo', stick:'goo'};
G.pb.push(b); sim(.05, () => false, () => {});
ok('a goo round sticks where it hits', (e.stuck || []).some(q => q.kind === 'goo'), JSON.stringify(e.stuck));
// a hacked player reloads and recharges slower
const regen = () => { p.en = 0; const t = G.time; sim(1, () => false, () => { p.vx = p.vy = 0; }); return p.en; };
p.enRegen = 10; p.enMax = 1e4; G.ships = [p];
const free = regen(); p.stuck = []; for (let n=0; n<3; n++) stick(p, CORE, p.x, p.y, 'hack');
const hacked = regen();
ok('hacked generators make less energy', hacked < free*.2, `${hacked.toFixed(1)} vs ${free.toFixed(1)}`);
