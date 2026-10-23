// Weapon groups are per weapon: two cannons in different groups, only the one on auto fires without player input.
fresh();
G.design = new Map([[CORE,'core'],[K(-1,-1),'cannon'],[K(1,-1),'cannon'],[K(-1,0),'gen'],[K(1,0),'gen']]);
G.dirs = new Map([[K(-1,-1),0],[K(1,-1),0]]);
G.grp = {[K(-1,-1)]:1, [K(1,-1)]:2}; G.auto = [false,true,false,false,false];
ok('two cannons, two groups', grpOf(K(-1,-1),'cannon') === 1 && grpOf(K(1,-1),'cannon') === 2);
startFight('fight'); G.waves = []; G.ships = [G.player];
G.player.guns = G.player.guns.filter(g => g.t!=='core');
dummy(200);
G.mouse.has = true; G.mouse.x = W/2; G.mouse.y = 0; G.fireHeld = false; G.aimAuto = false; for (const k in keys) keys[k] = false;
// note which side each new shot leaves from
const shots = [], seen = new Set();
const watch = () => { for (const b of G.pb) if (!seen.has(b)){ seen.add(b); shots.push(b.x < G.player.x ? 'left' : 'right'); } };
sim(4, () => false, watch);
ok('auto group fires on its own', shots.includes('right'), shots.length + ' shots');
ok('manual group waits for the player', !shots.includes('left'));
shots.length = 0; G.fireHeld = true; sim(3, () => false, watch);
ok('manual group fires with the player', shots.includes('left'));
// removing a weapon forgets its group
G.mode = 'build'; sellAt(-1,-1);
ok('removed weapon drops its group', !(K(-1,-1) in G.grp));
// the group brush assigns the clicked weapon only
G.grpBrush = 3; buildAction(1,-1,'place',true); G.grpBrush = 0;
ok('brush assigns one weapon', grpOf(K(1,-1),'cannon') === 3);
