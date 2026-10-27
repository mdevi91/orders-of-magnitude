// Test simulation: a mock fight from the drydock that leaves the run exactly as it was, won or lost.
fresh(); newRun();
G.design = new Map([[CORE,'core'],[K(0,-1),'cannon'],[K(-1,0),'gen'],[K(1,0),'battery']]); G.dirs = new Map(); G.broken = new Set([K(1,0)]);
G.credits = 123; G.stage = 2; G.mode = 'build';
const stats0 = JSON.stringify(G.stats);
ACT.sim('s7'); ACT.sim('+line');
startSim();
ok('the test flies in the chosen sector, whole', G.sim && G.stage === 7 && G.mode === 'combat' && G.player.blocks.has(K(1,0)));
ok('mock enemies are out', G.ships.filter(s => s.team==='e').length === 3, `${G.ships.filter(s => s.team==='e').length} hostiles`);
// losing ends only the test
killShip(G.player);
for (let n=0; n<200 && G.sim; n++) update(1/30);
ok('a lost test comes back to the run', !G.sim && G.mode === 'clear' && !!G.stats && G.stage === 2 && G.credits === 123 && JSON.stringify(G.stats) === stats0);
ok('damage is untouched', G.broken.size === 1 && G.broken.has(K(1,0)) && G.lost.size === 0);
// winning: every mock enemy down
startSim();
for (const e of G.ships) if (e.team==='e'){ e.warp = 0; killShip(e); }
for (let n=0; n<60 && G.sim; n++) update(1/30);
ok('a won test pays nothing', !G.sim && G.credits === 123 && G.stage === 2 && JSON.stringify(G.stats) === stats0);
