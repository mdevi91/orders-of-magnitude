// A whole run clicked through the real UI: map jumps, fights (helped along), loot picks, shops, signals and the drydock,
// checking that nothing throws and every screen leads somewhere.
fresh();
let jumps = 0, fights = 0, sectors = 0, stuck = '';
const finishFight = () => {
  // let it play for a while, then remove the enemies one by one so every fight ends
  sim(60, () => false, t => { if (t > 6 && ((t*30)|0) % 20 === 0){ const e = G.ships.find(s => s.team==='e' && s.alive); if (e) killShip(e); } });
};
const clickThrough = () => {
  for (let n=0; n<10 && !$('overlay').hidden; n++){
    if (G.pick){ const b = document.querySelector('#ovText [data-act^="pick"]'); if (b) b.click(); else G.pick(null); continue; }
    for (const b of [...document.querySelectorAll('#ovText [data-act]')]) if (!b.disabled) b.click();
    const a = document.querySelector('#ovActions button'); if (!a) break;
    a.click();
    if (G.mode==='combat'){ fights++; finishFight(); }
  }
};
for (; jumps < 80 && G.stats && G.stage <= 4; jumps++){
  if (G.mode !== 'map') toMap();
  const cur = curNode();
  if (exitNode(cur) && G.map.done){ nextSector(); sectors++; continue; }
  const opts = G.map.nodes.filter(canJump);
  if (!opts.length){ stuck = cur.type; break; }
  jumpTo(opts[(Math.random()*opts.length)|0]);
  if (G.mode==='combat'){ fights++; finishFight(); }
  clickThrough();
  if (!G.stats) break;
  toDrydock(); renderBuild(); syncUI();
}
log(`${jumps} jumps, ${fights} fights, ${sectors} sectors, ended in sector ${G.stage} (${G.stats ? 'alive' : 'run over'})`);
ok('never stuck on the map', !stuck, stuck);
ok('reached sector 2 or ended the run', G.stage >= 2 || !G.stats);
renderMap(); showTitle();
ok('title screen after the run', G.mode==='title');
