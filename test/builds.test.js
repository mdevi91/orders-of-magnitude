// Build balance probe: the two ways to fit a ship, measured against each other per sector. "many guns" is a full-size hull
// that is a third weapons; "one weapon" is a hull 40% that size with a single heavy weapon ringed by support modules.
// Logs real damage per second on a still target of an enemy's toughness at four distances, and wins in real fights
// (a bot kiting at its weapons' real reach; it does not dodge, so small ships fare better in a player's hands).
// Checks only that it all runs and the one-weapon ship outreaches the many guns.
const HEAVY = {3:'cannon', 6:'bigcannon', 9:'plasma', 12:'plasma'}, MIX = ['dmod','cmod','rmod','dmod','cmod','rmod','dmod'];
const near = () => { const c = []; for (let i=0; i<=14; i++) for (let j=-14; j<=14; j++) c.push([i,j]); return c.sort((a,b) => (a[0]**2 + a[1]**2*1.3) - (b[0]**2 + b[1]**2*1.3)); };
function finish(s, d, dirs, ts){ G.design = d; G.dirs = dirs; G.broken = new Set(); G.mnt = {}; G.ang = {}; G.grp = {}; G.lv = {}; for (const t of ts) G.lv[t] = Math.min(MAXLV, 1 + Math.floor((s-1)/2)); }
// fitted like a sensible player would: shields and point defense once unlocked, armour on what hull is left
function defend(s, d, lim){
  const free = [...d.keys()].filter(k => d.get(k)==='hull').sort((a,b) => Math.abs(KI(a)) + Math.abs(KJ(a)) - Math.abs(KI(b)) - Math.abs(KJ(b)));
  const sys = []; if (T.shield.unlock <= s) for (let n=0; n<Math.max(1, Math.floor(lim/30)); n++) sys.push('shield'); if (T.pd.unlock <= s) for (let n=0; n<Math.max(1, Math.floor(lim/25)); n++) sys.push('pd');
  sys.forEach((t,n) => { if (free[n]) d.set(free[n], t); });
  for (const k of free.slice(sys.length)) d.set(k,'armor');
}
function engines(d, dirs, n){ for (const k of [...d.keys()].filter(k => d.get(k)==='hull' && !d.has(K(KI(k), KJ(k)+1))).sort((a,b) => KJ(b) - KJ(a)).slice(0,n)){ d.set(k,'engine'); dirs.set(k,0); } }
function manyGuns(s, lim){
  const d = new Map([[CORE,'core']]), dirs = new Map();
  for (const [i,j] of near()){ if (d.size >= lim) break; if (i || j){ d.set(K(i,j),'hull'); d.set(K(-i,j),'hull'); } }
  engines(d, dirs, Math.max(2, Math.round(lim/9)));
  const hull = [...d.keys()].filter(k => d.get(k)==='hull').sort((a,b) => KJ(a) - KJ(b)), n = Math.round(lim/3), g = Math.round(lim/5), b = Math.round(lim/10), ws = ['cannon','gatling','flak'].filter(t => T[t].unlock <= s);
  hull.slice(0,n).forEach((k,q) => { const t = ws[q % ws.length]; d.set(k,t); dirs.set(k,0); });
  hull.slice(n,n+g).forEach(k => d.set(k,'gen')); hull.slice(n+g,n+g+b).forEach(k => d.set(k,'battery'));
  defend(s, d, lim); finish(s, d, dirs, [...ws,'gen','battery','hull','armor','shield','pd']);
}
function oneWeapon(s, lim, w, mods){
  const d = new Map([[CORE,'core']]), dirs = new Map(), hy = -1 - Math.max(...cellsFor(0,0,w,0).map(c => c[1]));
  const own = cellsFor(0,hy,w,0); for (const [i,j,ct] of own){ d.set(K(i,j),ct); if (T[ct].rot) dirs.set(K(i,j),0); }
  const ring = []; for (const [i,j] of own) for (const [a,b] of [[-1,0],[1,0],[-1,1],[1,1],[0,1],[-1,-1],[1,-1]]){ const k = K(i+a,j+b); if (!d.has(k) && !ring.includes(k) && (a || KJ(k) > hy)) ring.push(k); }
  ring.slice(0, mods.length).forEach((k,q) => d.set(k, mods[q]));
  for (const [i,j] of near()){ if (d.size >= lim) break; if ((i || j) && j >= hy) for (const k of [K(i,j),K(-i,j)]) if (!d.has(k)) d.set(k,'hull'); }
  engines(d, dirs, Math.max(2, Math.round(lim/7)));
  const hull = [...d.keys()].filter(k => d.get(k)==='hull'), g = Math.ceil(hull.length*.4), b = Math.ceil(hull.length*.15);
  hull.slice(0,g).forEach(k => d.set(k,'gen')); hull.slice(g,g+b).forEach(k => d.set(k,'battery'));
  defend(s, d, lim); finish(s, d, dirs, [w,'gen','battery','hull','armor','shield','pd']);
}
function stats(){
  startFight('fight'); G.waves = []; G.ships = [G.player]; const p = G.player, gs = p.guns.filter(g => g.t!=='core');
  return {blocks:blockCount(), r:p.r, guns:gs.length, reach:Math.max(...gs.map(g => rangeOf(g.t)*rangeMul(g.t)*boost(p,g).rng))};
}
function hulk(x, y, s){
  const m = new Map(); for (let i=-8; i<=8; i++) for (let j=-5; j<=5; j++) m.set(K(i,j), i || j ? ((i+j)%4 ? 'hull' : 'armor') : 'core');
  const e = makeShip(m, 'e', x, y, 1.15 + .22*(s-1)); e.station = true; e.spin = 0; e.guns = []; e.bays = []; e.shields = []; e.epd = []; e.sc = G.SC; e.value = 0; e.n0 = m.size; e.wob = 0; G.ships.push(e); return e;
}
function range(s, build, dist){
  let tot = 0, N = 3;
  for (let q=0; q<N; q++){
    fresh(s); build(); G.auto = [true,true,true,true,true]; G.fireHeld = false; G.aimJoy = null; G.aimAuto = false; startFight('fight'); G.waves = []; G.ships = [G.player];
    const p = G.player; p.guns = p.guns.filter(g => g.t!=='core');
    const e = hulk(p.x, p.y - dist - 60, s), t = sim(30, () => !e.alive, () => { p.vx = p.vy = 0; p.a = 0; p.av = 0; });
    tot += (e.lifeMax - Math.max(0, e.life))/Math.max(t, .5);
  }
  return tot/N;
}
function fight(kind){
  G.auto = [true,true,true,true,true]; G.aimAuto = true; G.mouse.has = false; startFight(kind);
  const p = G.player, gs = p.guns.filter(g => g.t!=='core'), rs = gs.map(g => rangeOf(g.t)*rangeMul(g.t)*boost(p,g).rng), want = (rs.length ? rs.reduce((a,b) => a+b, 0)/rs.length : 300)*.85 + p.r*.5, hp0 = [...p.blocks.values()].reduce((a,b) => a + b.max, 0);
  const t = sim(kind==='fight' ? 150 : 300, () => !p.alive, () => {
    for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = false;
    let e = G.ships.filter(x => x.team==='e' && x.alive).sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y))[0]; if (!e) return;
    if (G.boss && G.boss.alive && G.boss.station) e = G.boss;
    const w = e.station ? 120 : want, dx = e.x-p.x, dy = e.y-p.y, dist = Math.hypot(dx,dy) - e.r, go = dist > w ? 1 : dist < w*.7 ? -1 : 0;
    const mx = dx/(dist||1)*go - dy/(dist||1)*.6, my = dy/(dist||1)*go + dx/(dist||1)*.6;
    if (mx > .3) keys.KeyD = true; if (mx < -.3) keys.KeyA = true; if (my > .3) keys.KeyS = true; if (my < -.3) keys.KeyW = true;
  });
  for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = false;
  return {won:G.mode==='clear', t, lost:1 - (p.alive ? [...p.blocks.values()].reduce((a,b) => a + b.hp, 0) : 0)/hp0};
}
let far = true;
log('damage per second at distance, then fights won of 8 (average hull lost)');
for (const s of [3,6,9,12]){
  const lim = Math.round(6 + 4*s + .8*s*s), w = HEAVY[s], small = Math.round(lim*.4), B = [['many guns', () => manyGuns(s,lim)], [`one ${w}`, () => oneWeapon(s,small,w,[])], [`one ${w}, modules`, () => oneWeapon(s,small,w,MIX)]];
  log(''); log(`SECTOR ${s}`);
  const reach = {};
  for (const [name, build] of B){
    fresh(s); build(); const st = stats(); reach[name] = st.reach;
    const v = [200,400,700,1000].map(x => range(s, build, x).toFixed(0).padStart(5)).join(' ');
    const f = ['fight','elite','gate', ...(s%3===0 ? ['boss'] : [])].map(kind => { let won = 0, lost = 0, n = 8; for (let q=0; q<n; q++){ fresh(s); build(); const r = fight(kind); if (r.won) won++; lost += r.lost; } return `${kind} ${won}/${n} (${Math.round(lost/n*100)}%)`; }).join('  ');
    log(`${name.padEnd(22)} ${String(st.blocks).padStart(3)} blocks, reach ${st.reach.toFixed(0).padStart(4)} | dps ${v} | ${f}`);
  }
  far = far && reach[`one ${w}, modules`] > reach['many guns'];
}
ok('one weapon with modules outreaches many guns', far);
