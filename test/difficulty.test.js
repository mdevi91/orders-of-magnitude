// Difficulty probe: a bot builds a reasonable ship for each sector (block limit, unlocked weapons, some upgrades)
// and fights with every group on auto while kiting at range. Logs win rates and damage taken; checks the game
// is beatable early but not a walkover.
function botShip(s){
  const tier = tierOf(s), lim = Math.round(blockLimit()*.9);
  const guns = ['cannon','gatling','scatter','flak','missile','ion','torpedo','tesla'].filter(t => T[t].unlock <= tier);
  // cells around the core, nearest first, in mirrored pairs
  const cells = [];
  for (let i=0; i<=12; i++) for (let j=-12; j<=12; j++) cells.push([i,j]);
  cells.sort((a,b) => (a[0]**2 + a[1]**2*1.3) - (b[0]**2 + b[1]**2*1.3));
  const d = new Map([[CORE,'core']]);
  for (const [i,j] of cells){
    if (d.size >= lim) break;
    if (i===0 && j===0) continue;
    d.set(K(i,j),'hull'); if (i) d.set(K(-i,j),'hull');
  }
  const dirs = new Map(), keys = [...d.keys()].filter(k => k!==CORE);
  const outer = k => NB.some(n => !d.has(k+n));
  const rim = keys.filter(outer), inner = keys.filter(k => !outer(k));
  // engines along the back edge, weapons spread round the rim facing outwards, power and armour inside
  const back = rim.filter(k => !d.has(K(KI(k), KJ(k)+1))).sort((a,b) => KJ(b) - KJ(a)).slice(0, Math.max(2, Math.round(d.size/9)));
  for (const k of back){ d.set(k,'engine'); dirs.set(k,0); }
  const nW = Math.max(1, Math.round(d.size/7));
  const spots = rim.filter(k => d.get(k)==='hull').sort(() => Math.random() - .5).slice(0, nW);
  spots.forEach((k,n) => { const t = guns[n % guns.length]; d.set(k,t); if (T[t].rot) dirs.set(k, ((Math.round(Math.atan2(KI(k), -KJ(k))/(Math.PI/4)) % 8) + 8) % 8); });
  inner.slice(0, Math.round(nW*.6)).forEach(k => d.set(k,'gen'));
  inner.slice(Math.round(nW*.6), Math.round(nW*.6) + Math.round(nW*.3)).forEach(k => d.set(k,'battery'));
  // once unlocked, shields and point defense go on like a sensible player would fit them
  const sys = [];
  if (T.shield.unlock <= tier) for (let n=0; n<Math.floor(d.size/30); n++) sys.push('shield');
  if (T.pd.unlock <= tier) for (let n=0; n<Math.floor(d.size/25); n++) sys.push('pd');
  const free = keys.filter(k => d.get(k)==='hull').sort(() => Math.random() - .5);
  sys.forEach((t,n) => free[n] && d.set(free[n], t));
  for (const k of keys) if (d.get(k)==='hull' && Math.random() < .25 + .03*s) d.set(k,'armor');
  G.design = d; G.dirs = dirs; G.broken = new Set();
  G.lv = {}; for (const t of [...guns, 'armor','hull','gen','shield','pd']) G.lv[t] = Math.min(MAXLV, 1 + Math.floor((s-1)/2));
}
function botFight(kind){
  G.auto = [true,true,true,true,true]; G.aimAuto = true; G.mouse.has = false; // mouse-less: WASD move in screen directions
  startFight(kind);
  const p = G.player, hp0 = [...p.blocks.values()].reduce((a,b) => a + b.max, 0); let ehp = 0;
  // kite: hold 60-85% of the weapons' average reach from the nearest hostile, circling sideways
  const rs = [...new Set(p.guns.filter(g => g.t!=='core').map(g => rangeOf(g.t)))], want = (rs.length ? rs.reduce((a,b) => a+b, 0)/rs.length : 300)*.85*G.SC + p.r*.5;
  const t = sim(kind==='fight' ? 150 : 300, () => !p.alive, () => {
    for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = false;
    let e = G.ships.filter(x => x.team==='e' && x.alive).sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y))[0];
    if (!e) return;
    if (G.boss && G.boss.alive && G.boss.station) e = G.boss; // a starbase is the objective: go for it, not its escorts
    if (!ehp) ehp = G.ships.filter(x => x.team==='e').reduce((a,x) => a + [...x.blocks.values()].reduce((q,b) => q + b.max, 0), 0) | 0;
    // a starbase never moves, so close in on it
    const w = e.station ? 120*G.SC : want;
    const dx = e.x-p.x, dy = e.y-p.y, dist = Math.hypot(dx,dy) - e.r, toward = dist > w ? 1 : dist < w*.7 ? -1 : 0;
    const mx = dx/(dist||1)*toward - dy/(dist||1)*.6, my = dy/(dist||1)*toward + dx/(dist||1)*.6;
    if (mx > .3) keys.KeyD = true; if (mx < -.3) keys.KeyA = true; if (my > .3) keys.KeyS = true; if (my < -.3) keys.KeyW = true;
  });
  for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = false;
  const left = p.alive ? [...p.blocks.values()].reduce((a,b) => a + b.hp, 0) : 0;
  return {won: G.mode==='clear', t, lost: 1 - left/hp0, ehp};
}
const rate = {};
for (const s of [1,2,3,4,6,9]){
  for (const kind of ['fight','elite','gate', ...(s%3===0 ? ['boss','station'] : [])]){
    const n = kind==='fight' ? 4 : 3, res = [];
    for (let q=0; q<n; q++){ fresh(s); botShip(s); res.push(botFight(kind)); }
    if (kind==='fight'){ const st = designStats(); log(`  bot: ${blockCount()} blocks, ${Math.round(st.dps)} dps, ${Math.round(st.hp)} hp; enemy hull ${res.map(r => r.ehp).join('/')}`); }
    const won = res.filter(r => r.won).length, lost = res.reduce((a,r) => a + r.lost, 0)/n;
    rate[s+kind] = won/n;
    log(`sector ${s} ${kind.padEnd(7)} won ${won}/${n}  hull lost ${(lost*100).toFixed(0)}%  ${res.map(r => r.t.toFixed(0)+'s').join(' ')}`);
  }
}
ok('a first-sector fight is winnable', rate['1fight'] > 0);
ok('not a walkover: some sector 3+ fights are lost', Object.entries(rate).some(([k,v]) => parseInt(k) >= 3 && v < 1));
