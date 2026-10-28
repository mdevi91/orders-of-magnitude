// Capital fights: no battle phases, and the fight is won only once every hostile is gone, the swarm included.
fresh(); newRun(); G.stage = 3;
startFight('boss');
sim(6, () => !!G.boss);
const B = G.boss;
ok('a flagship arrives', !!B && B.flag);
// a few swarm fighters on the field, then the flagship falls
spawnSwarm(); spawnSwarm();
const left = () => G.ships.filter(s => s.alive && s.team==='e');
ok('swarm fighters are out', left().some(s => s.fodder));
const n0 = left().filter(s => s.fodder).length;
for (const s of left()) if (!s.fodder){ s.alive = false; s.blocks.clear(); }
let said = '';
sim(20, () => G.mode !== 'combat', () => { if (G.banner && !said.includes(G.banner.text)) said += G.banner.text + ' | '; for (const s of left()) if (s.fodder){ s.x = G.player.x + 3000; s.vx = s.vy = 0; } });
ok('the fight goes on while ships are left', G.mode === 'combat', G.mode);
ok('no more swarm once the flagship is down', left().filter(s => s.fodder).length <= n0);
ok('the banner says to clear the field', /clear the field/i.test(said), said);
for (const s of left()) killShip(s);
sim(5, () => G.mode !== 'combat');
ok('won once the last ship is down', G.mode === 'clear', G.mode);
// the call to clear the field waits for the flagship: not while it is still warping in
fresh(); newRun(); G.stage = 3; startFight('boss');
let early = '';
sim(4, () => false, () => { if (G.banner && /clear the field/i.test(G.banner.text)) early = G.banner.text; });
ok('no clear-the-field call while the flagship arrives', !early && G.boss && G.boss.alive);
