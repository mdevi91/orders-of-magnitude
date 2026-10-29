// Hardpoints, stage 3: mounts come from cargo and are fitted onto placed weapons; a tap on a weapon already on the
// selected mount angles its arc 15° at a time; mirror twins follow; taking a weapon off returns its mount.
fresh(); G.stage = 6; G.outfit = false; G.mir = 1;
G.design = new Map([[CORE,'core'], [K(-1,-1),'cannon'], [K(1,-1),'cannon'], [K(0,-1),'hull'], [K(-1,0),'hull'], [K(1,0),'hull']]);
G.dirs = new Map([[K(-1,-1),0], [K(1,-1),0]]); G.broken = new Set(); G.mnt = {}; G.ang = {}; G.inv = {mbarbette:1, mfixed:2, mdome:1};
const L = K(-1,-1), R = K(1,-1);
ok('weapons start on their stock mount', mountAt(L, 'cannon') === 'ring' && !G.mnt[L]);
G.sel = 'mfixed'; buildAction(-1, -1, 'place', true);
ok('a fixed mount fits both mirror twins from cargo', G.mnt[L] === 'fixed' && G.mnt[R] === 'fixed' && (G.inv.mfixed || 0) === 0, JSON.stringify([G.mnt, G.inv]));
buildAction(-1, -1, 'place', true);
ok('a tap angles the arc 15°, the twin mirrored', G.ang[L] === 1 && G.ang[R] === -1, JSON.stringify(G.ang));
for (let n=0; n<3; n++) buildAction(-1, -1, 'place', true);
ok('the angle wraps from +45° to -45°', G.ang[L] === -3, G.ang[L]);
buildAction(-1, -1, 'place', false);
ok('dragging over it does not angle it', G.ang[L] === -3);
G.mir = 0; G.sel = 'mbarbette'; buildAction(-1, -1, 'place', true);
ok('a new mount swaps in, the old one back to cargo, the angle kept', G.mnt[L] === 'barbette' && G.inv.mfixed === 1 && G.inv.mbarbette === 0 && G.ang[L] === -3, JSON.stringify([G.mnt, G.inv, G.ang]));
G.sel = 'mring'; buildAction(-1, -1, 'place', true);
ok('fitting the stock kind takes the fitted mount off for free', !G.mnt[L] && G.inv.mbarbette === 1, JSON.stringify([G.mnt, G.inv]));
G.sel = 'mdome'; G.design.set(K(0,-2), 'laser'); for (const [i,j,ct] of cellsFor(0,-2,'laser',0)) G.design.set(K(i,j), ct);
ok('a dome takes small weapons only', mountFits('laser', 'dome') !== true && mountFits('cannon', 'dome') === true);
ok('guided launchers need no mount', mountFits('missile', 'ring') !== true);
// selling a weapon returns its mount
G.sel = 'mfixed'; buildAction(1, -1, 'place', true);
const had = G.inv.mfixed || 0; G.mir = 0; sellAt(1, -1);
ok('selling the weapon returns its mount to cargo', G.inv.mfixed === had + 1 && !G.mnt[R], JSON.stringify(G.inv));
// in a fight the block carries its mount and angle, and a fixed mount hits harder
G.design.delete(K(0,-2)); for (const [i,j] of cellsFor(0,-2,'laser',0)) G.design.delete(K(i,j));
G.mnt = {[L]:'fixed'}; G.ang = {[L]:2};
startFight('fight'); G.waves = []; G.ships = [G.player];
const g = G.player.guns.find(b => b.i===-1 && b.j===-1);
ok('the fighting block carries mount and angle', g.mk === 'fixed' && Math.abs(g.ao - 2*ANG_STEP) < 1e-9, `${g.mk} ${g.ao}`);
const V = traverse('cannon', 'fixed');
ok('a fixed mount: no turning, more damage and range', V.turn === 0 && V.dmg > 1 && V.rng > 1 && V.spread < 1);
ok('a barbette fires over the hull, a ring does not', traverse('cannon','barbette').over && !traverse('cannon','ring').over);
ok('mounts are in the palette, not upgradable', ['mfixed','mgimbal','mring','mbarbette','mdome'].every(t => PAL.includes(t) && T[t].mount));
