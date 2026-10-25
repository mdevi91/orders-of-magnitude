// The Aegis array: a 4x4 point defense that only works whole, reaches far, and shoots down cannon slugs too.
fresh();
G.design = new Map([[CORE,'core'],[K(1,0),'gen'],[K(2,0),'battery']]); G.dirs = new Map();
for (const [i,j,ct] of cellsFor(-4,-1,'aegis',0)) G.design.set(K(i,j), ct);
ok('aegis footprint is 16 cells', cellsFor(-4,-1,'aegis',0).length === 16);
startFight('fight'); G.waves = []; G.ships = [G.player];
ok('a whole aegis array defends', G.player.pds.length === 1 && G.player.pds[0].t==='aegis');
// a cannon slug far beyond normal point defense reach, flying at the ship
const p = G.player, d = 150*Math.sqrt(G.S);
G.eb.push({x:p.x, y:p.y - d, vx:0, vy:40, sp:40, r:1, dmg:10, life:5, kind:'eoval'});
for (let n=0; n<20; n++) update(1/30);
ok('it shoots down a cannon slug at long range', G.eb.every(b => b.dead || b.kind!=='eoval'));
