// The Aegis array: a 2x3 point defense that only works whole, reaches far, and shoots down cannon slugs too.
fresh();
G.design = new Map([[CORE,'core'],[K(1,0),'gen'],[K(2,0),'battery']]); G.dirs = new Map();
for (const [i,j,ct] of cellsFor(-2,-1,'aegis',0)) G.design.set(K(i,j), ct);
ok('aegis footprint is 6 cells', cellsFor(-2,-1,'aegis',0).length === 6);
startFight('fight'); G.waves = []; G.ships = [G.player];
ok('a whole aegis array defends', G.player.pds.length === 1 && G.player.pds[0].t==='aegis');
// a cannon slug far beyond normal point defense reach, flying at the ship
const p = G.player, d = 150*Math.sqrt(G.S);
G.eb.push({x:p.x, y:p.y - d, vx:0, vy:40, sp:40, r:1, dmg:10, life:5, kind:'eoval'});
for (let n=0; n<20; n++) update(1/30);
ok('it shoots down a cannon slug at long range', G.eb.every(b => b.dead || b.kind!=='eoval'));
// a save from when the array was 4x4: its extra body cells come off on load, the rest of the ship stays
fresh(); newRun();
G.design = new Map([[CORE,'core'],[K(1,0),'gen']]); G.dirs = new Map(); fitCockpit();
for (const [i,j,ct] of cellsFor(-2,-1,'aegis',0)) G.design.set(K(i,j), ct);
G.design.set(K(-3,-1), 'aegis_b'); G.design.set(K(-2,2), 'aegis_b');
const n0 = G.design.size; load(saveData());
ok('old 4x4 leftovers are pruned on load', G.design.size === n0 - 2 && !G.design.has(K(-3,-1)) && G.design.get(K(-2,-1))==='aegis' && G.design.get(K(1,0))==='gen');
