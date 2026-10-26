// After-action report: the run tracks damage dealt and taken, blocks lost and time, and lists what it unlocked.
fresh();
ok('a new run notes where it started', G.stats.best0 === 1 && G.stats.peak === blockCount());
G.design = new Map([[CORE,'core'],[K(0,-1),'cannon'],[K(-1,0),'hull'],[K(1,0),'hull']]); G.dirs = new Map([[K(0,-1),0]]);
startFight('fight'); G.waves = []; G.ships = [G.player];
const e = dummy(150);
damage(e, CORE, 20); // the core, so armour doesn't soak part of it
ok('damage dealt is counted', Math.abs(G.stats.dealt - 20) < 1e-6, G.stats.dealt);
const k = K(-1,0); damage(G.player, k, 999);
ok('damage taken and blocks lost are counted', G.stats.taken > 0 && G.stats.lost === 1, `${G.stats.taken} / ${G.stats.lost}`);
sim(1);
ok('time in combat is counted', G.stats.secs > .9);
// reaching sector 2 unlocks the gatling, missile and the corvette cockpit
reachSector(2);
runOver('abandoned');
const txt = $('ovText').textContent;
ok('the report shows the combat log', txt.includes('Damage dealt') && txt.includes('Blocks lost') && txt.includes('Time in combat'));
ok('the report lists what the run unlocked', txt.includes('Unlocked this run') && txt.includes(T.gatling.name) && txt.includes('Corvette'), txt.slice(txt.indexOf('Unlocked'), txt.indexOf('Unlocked') + 160));
