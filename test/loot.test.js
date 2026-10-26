// Loot odds: deeper sectors lean rarer, but capped, and a pick of three never shows two epic-or-better blocks.
fresh(); G.meta.best = 12; G.meta.lv = {proto:5}; newRun(); G.stage = 12;
const n = {0:0, 4:0}, N = 6000;
for (let q=0; q<N; q++){ const r = rarOf(rollBlock(1.6)); if (r in n) n[r]++; }
ok('a legendary stays rarer than a common, even deep with max prototype access', n[4] < n[0]/3);
let worst = 0;
for (let q=0; q<300; q++){
  chooseLoot(1, 1.6, 'Test', '', () => {});
  const offers = [...document.querySelectorAll('.pick[data-act^="pick:"]')].map(b => b.dataset.act.slice(5));
  worst = Math.max(worst, offers.filter(t => rarOf(t) >= 3).length);
  G.pick(null);
}
ok('a pick never shows two epic-or-better blocks', worst <= 1);
