// Mount balance probe: every turret on every mount it fits, in three real fights on auto fire with unlimited energy.
// near: a small hulk weaving side to side at 60% of the weapon's stock reach (tracking);
// far: a big still hulk at 115% of stock reach (only mounts that add reach can hit it);
// flank: a small hulk circling the ship at half reach (arc and turn speed).
// Logs damage per second in each and the average against the stock mount; checks only that it all runs.
const W = ['cannon','gatling','plasma','bigcannon'], SECS = 40, REP = 3;
function rig(t, mk){
  const len = PARTS[t] ? PARTS[t].len : 1, d = new Map([[CORE,'core'],[K(-1,0),'gen'],[K(1,0),'gen'],[K(0,1),'battery']]);
  for (const [i,j,ct] of cellsFor(0,-len,t,0)) d.set(K(i,j), ct);
  G.design = d; G.dirs = new Map([[K(0,-len),0]]); G.broken = new Set(); G.mnt = mk ? {[K(0,-len)]:mk} : {}; G.ang = {};
  startFight('fight'); G.waves = []; G.ships = [G.player];
  G.auto = [true,true,true,true,true]; G.fireHeld = false; G.aimJoy = null; G.aimAuto = false;
  G.player.guns = G.player.guns.filter(g => g.t!=='core'); G.player.enMax = 1e6;
}
function hulk(x, y, w, h){
  const m = new Map(); for (let i=-w; i<=w; i++) for (let j=-h; j<=h; j++) m.set(K(i,j), i||j ? 'hull' : 'core');
  const e = makeShip(m, 'e', x, y, 40);
  e.station = true; e.spin = 0; e.guns = []; e.bays = []; e.shields = []; e.epd = []; e.sc = G.SC; e.value = 0; e.n0 = m.size; e.wob = 0;
  G.ships.push(e); return e;
}
function run(t, mk, kind){
  fresh(); G.stage = 6; rig(t, mk);
  const p = G.player, R = rangeOf(t)*G.SC, hold = () => { p.vx = p.vy = 0; p.a = 0; p.av = 0; p.en = 1e6; };
  let e, step;
  if (kind==='near'){ e = hulk(p.x, p.y - R*.6 - BS, 2, 1); const x0 = e.x, sw = 140*G.SC; step = tt => { e.x = x0 + Math.sin(tt*.9)*sw; e.vx = Math.cos(tt*.9)*sw*.9; }; }
  else if (kind==='far'){ e = hulk(p.x, p.y - R*1.15 - 4*BS, 6, 4); step = () => {}; }
  else { const r = R*.5 + BS; e = hulk(p.x, p.y - r, 2, 1); step = tt => { const a = -Math.PI/2 + tt*.55; e.x = p.x + Math.cos(a)*r; e.y = p.y + Math.sin(a)*r; e.vx = -Math.sin(a)*r*.55; e.vy = Math.cos(a)*r*.55; }; }
  sim(SECS, () => false, tt => { hold(); step(tt); });
  return (e.lifeMax - e.life)/SECS;
}
const KINDS = ['near','far','flank'], f1 = (v, n) => v.toFixed(1).padStart(n), pc = v => ((v >= 0 ? '+' : '') + Math.round(v*100) + '%').padStart(6);
const gain = {};
let threw = '';
try {
  for (const t of W){
    const stock = mountFor(t), mks = [stock, ...Object.keys(MOUNT_ITEM).filter(mk => mountFits(t, mk) === true)];
    log(''); log(`${T[t].name.toUpperCase()} (stock ${MOUNTS[stock].name})`);
    log('mount                 cost    near     far   flank     avg  vs stock');
    let base = 0, b3 = [0,0,0];
    for (const mk of mks){
      const r = KINDS.map(k => { let s = 0; for (let n=0; n<REP; n++) s += run(t, mk===stock ? null : mk, k); return s/REP; }), avg = (r[0] + r[1] + r[2])/3;
      if (mk===stock){ base = avg; b3 = r; }
      const cost = mk===stock ? 0 : T[MOUNT_ITEM[mk]].cost;
      if (mk!==stock) (gain[mk] ||= []).push({r, b:b3});
      log(`${MOUNTS[mk].name.padEnd(20)} ${String(cost).padStart(5)} ${r.map(v => f1(v,7)).join(' ')} ${f1(avg,7)} ${mk===stock ? '     —' : pc(avg/base - 1)}`);
    }
  }
  log(''); log('ACROSS WEAPONS: change against stock up close (weaving target) and on the flank (circling target), and');
  log('how many of the weapons it lets reach the far target that stock cannot');
  log('mount                 cost     near    flank   reaches far');
  for (const mk of Object.keys(gain)){
    // totals over the weapons, so a weapon whose stock mount barely hits can't blow the percentage up
    const g = gain[mk], n = g.length, sum = (q, f) => g.reduce((a,x) => a + x[q][f], 0);
    const near = sum('r',0)/sum('b',0) - 1, flank = sum('r',2)/sum('b',2) - 1, far = g.filter(x => x.r[1] > .5 && x.b[1] < .5).length;
    log(`${MOUNTS[mk].name.padEnd(20)} ${String(T[MOUNT_ITEM[mk]].cost).padStart(5)}   ${pc(near)}   ${pc(flank)}   ${far}/${n}`);
  }
} catch (e){ threw = String(e.stack || e); }
ok('the probe runs', !threw, threw);
