// @ts-nocheck
import { sfx } from './audio';
import { MAXLV, PAL, PLATE, T, lvOf, onShip, owned, repCost, tierOf } from './catalog';
import { startFight } from './fights';
import { CORE, rand } from './grid';
import { metaLv } from './runs';
import { save } from './save';
import { row } from './shop';
import { toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import { showOverlay } from './ui';

// ---------- loot ----------
export const lootPool = () => PAL.filter(t => t!=='sell' && !PLATE(t) && T[t].unlock <= tierOf(G.stage) + metaLv('proto'));
// cheap blocks are common and expensive ones rare; boost flattens the odds
export function rollBlock(boost=1, pool=lootPool()){
  const w = pool.map(t => Math.pow(40/T[t].cost, .8/boost));
  let r = Math.random()*w.reduce((a,b) => a+b, 0);
  for (let n=0; n<pool.length; n++) if ((r -= w[n]) < 0) return pool[n];
  return pool[0];
}
// G.dmg[t] of the G.inv[t] blocks in cargo are damaged. Taking one uses an intact block first (or a damaged one first, for selling); returns whether it was damaged.
export const dmgOf = t => Math.min(G.dmg[t]||0, G.inv[t]||0);
export function takeCargo(t, damagedFirst=false){
  const d = dmgOf(t), hurt = damagedFirst ? d > 0 : G.inv[t] - d <= 0;
  G.inv[t]--; G.dmg[t] = hurt ? d - 1 : Math.min(d, G.inv[t]);
  return hurt;
}
export function addBlock(t, n=1){ if (!owned(t)) G.fresh.add(t); G.inv[t] = (G.inv[t]||0) + n; }
export function giveLoot(boost){ const t = rollBlock(boost); addBlock(t); return t; }
// Loot you choose: each pick offers three different blocks, or skip. done gets the blocks taken.
export function chooseLoot(n, boost, title, intro, done){
  const got = []; tut('loot');
  const step = () => {
    if (got.length >= n) return done(got);
    const offers = [];
    for (let q=0; offers.length < 3 && q < 30; q++){ const t = rollBlock(boost); if (!offers.includes(t)) offers.push(t); }
    G.pick = t => { G.pick = null; if (t){ addBlock(t); got.push(t); sfx('place'); } else got.push(null); step(); };
    showOverlay(title, intro + `<div class="rows"><h3>Choose a block${n > 1 ? ` · ${got.length+1} of ${n}` : ''}</h3>` +
      offers.map((t,i) => row(T[t].name + (owned(t) ? '' : ' · new'), T[t].desc, 'Take', `pick:${t}`)).join('') + '</div>',
      [['Skip', () => G.pick && G.pick(null), 'ghost']], true);
  };
  step();
}
export const lootText = got => (got = got.filter(Boolean)).length ? ` Found: <b class="gold">${got.map(t => T[t].name).join(', ')}</b>.` : '';
export const chance = p => Math.random() < p;
// credit income: every source pays half of what it used to
export const inc = v => Math.round(v*.5);
export const cargoTypes = () => Object.keys(G.inv).filter(t => G.inv[t] > 0);
export function damageRandom(n){
  const ks = [...G.design.keys()].filter(k => k!==CORE && !G.broken.has(k));
  let c = 0;
  for (; c<n && ks.length; c++){ const i = (Math.random()*ks.length)|0; G.broken.add(ks[i]); ks.splice(i,1); }
  return c;
}
export function upgradeRandom(){
  const ts = PAL.filter(t => t!=='sell' && (onShip(t) || G.inv[t] > 0) && lvOf(t) < MAXLV);
  if (!ts.length) return null;
  const t = ts[(Math.random()*ts.length)|0]; G.lv[t] = lvOf(t) + 1; return t;
}
export const repTotal = (mul=1) => { let c = 0; for (const k of G.broken) if (G.design.has(k)) c += Math.ceil(repCost(G.design.get(k))*mul); return c; };
// repairs damaged blocks one by one while the credits last; returns how many were fixed
export function repair(mul=1){
  let n = 0;
  for (const k of [...G.broken]){
    if (!G.design.has(k)){ G.broken.delete(k); continue; }
    const c = Math.ceil(repCost(G.design.get(k))*mul); if (c > G.credits) continue;
    G.credits -= c; G.broken.delete(k); n++;
  }
  return n;
}
export function salvage(n){
  n.used = true;
  if (chance(.3)){ showOverlay('Wreckage', 'The wreck is bait. Hostiles are closing in.', [['Fight', () => startFight('ambush')]]); return; }
  const cr = inc(rand(15,30) + 6*G.stage), head = `You strip the wreck for <b class="gold">${cr}</b> credits.`;
  G.credits += cr; save();
  chooseLoot(chance(.35) ? 2 : 1, 1, 'Wreckage', head, got => { save(); showOverlay('Wreckage', head + lootText(got), [['Star map', toMap]]); });
}
export function repairDock(n){
  n.used = true;
  const c = G.broken.size; G.broken.clear(); sfx('upgrade');
  if (!c) G.credits += 10;
  save();
  showOverlay('Repair dock', c ? `The crew fixes <b>${c}</b> damaged block${c>1?'s':''}, free of charge.` : 'Nothing to fix. The crew pays you <b class="gold">20</b> credits for your spare plating.', [['Star map', toMap]]);
}
