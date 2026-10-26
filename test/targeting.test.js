// Targeting mode: Q, click a hostile to lock it; auto weapons and missiles go for the lock; a click on space clears it.
fresh(4); startFight('fight');
sim(10, () => G.ships.filter(e => e.team==='e' && e.alive && !e.warp).length > 0);
const es = G.ships.filter(e => e.team==='e' && e.alive && !e.warp);
ok('a hostile arrived', es.length > 0);
const E = es[0];
toggleTargeting(); ok('Q turns targeting on', G.tgtMode === true);
// click right on one of its blocks
renderCombat();
const b = [...E.blocks.values()][0], [bx, by] = wpos(E, b);
targetClick((bx - G.camX)*G.zoom + W/2, (by - G.camY)*G.zoom + H/2);
ok('a click on a ship locks it', G.lock === E && !G.tgtMode, `lock ${G.lock ? 'set' : 'none'}`);
ok('locked() returns it', locked() === E);
syncTargeting();
ok('the target card shows', !document.getElementById('tgtCard').hidden && /Integrity/i.test(document.getElementById('tgtCard').textContent));
// homing missiles retarget to the lock
pBullet(G.player.x, G.player.y, 0, T.missile.gun, null, 1); update(1/30);
ok('missiles home on the lock', G.pb[G.pb.length-1].target === E);
// a click on empty space clears it
toggleTargeting(); targetClick(5, H - 5);
ok('a click on space clears the lock', G.lock === null && !G.tgtMode);
syncTargeting();
ok('the card hides', document.getElementById('tgtCard').hidden);
