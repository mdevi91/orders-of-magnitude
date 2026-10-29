// Hardpoints, stage 2: a turret aims through its mount's arc and swings at the mount's speed, firing only once it is on target.
fresh();
G.design = new Map([[CORE,'core'], [K(0,-1),'cannon'], [K(-1,0),'gen'], [K(1,0),'gen']]); G.dirs = new Map([[K(0,-1),0]]); G.broken = new Set();
startFight('fight'); G.waves = []; G.ships = [G.player];
G.auto = [true,true,true,true,true]; G.fireHeld = false; G.aimJoy = null;
const p = G.player; p.guns = p.guns.filter(g => g.t!=='core');
const g = p.guns[0], TV = traverse('cannon'), d = 200*G.SC, a = 50*Math.PI/180;
ok('the cannon sits on a turret ring', mountFor('cannon') === 'ring' && Math.abs(TV.arc - cpArc(MOUNTS.ring.arc)) < 1e-9, TV.arc);
const e = dummy(d); e.wob = 0;
const place = () => { p.vx = p.vy = 0; p.a = 0; p.av = 0; e.x = p.x + Math.sin(a)*d; e.y = p.y - Math.cos(a)*d; };
place();
const fired = () => G.pb.length > 0;
sim(.2, () => false, place);
ok('a turret off target does not fire straight away', !fired(), `swung to ${((g.tr || 0)*180/Math.PI).toFixed(0)}°`);
ok('it swings at its mount speed', Math.abs((g.tr || 0) - TV.turn*.2) < TV.turn*.1, `${(g.tr || 0).toFixed(3)} vs ${(TV.turn*.2).toFixed(3)}`);
sim(1.5, fired, place);
ok('once on target it fires', fired(), `swung to ${((g.tr || 0)*180/Math.PI).toFixed(0)}°`);
ok('bigger mounts swing slower', traverse('bigcannon').turn < traverse('plasma').turn && traverse('plasma').turn < traverse('cannon').turn,
  ['cannon','plasma','bigcannon'].map(t => (traverse(t).turn*180/Math.PI).toFixed(0)).join(' / '));
ok('guided launchers do not swing', !turns('missile') && !turns('mirv') && turns('cannon') && turns('glimmer'));
ok('the stat line says how fast it turns', /turns \d+°\/s/.test(blurb('cannon')), blurb('cannon'));
