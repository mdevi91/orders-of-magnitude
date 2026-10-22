// @ts-nocheck
import { sfx } from './audio';
import { MAXLV, PAL, T, lvOf, onShip, priceMul, repCost, upCost } from './catalog';
import { addBlock, cargoTypes, dmgOf, lootPool, repTotal, repair, rollBlock, takeCargo } from './loot';
import { META, metaCost, metaLv, showTitle } from './runs';
import { saveMeta } from './save';
import { toDrydock, toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import { showOverlay } from './ui';
import { $ } from './view';

// ---------- shop ----------
export const buyPrice = t => Math.round(T[t].cost*1.1*priceMul());
export const sellPrice = t => Math.round(T[t].cost*.45);
export const row = (name, sub, label, act, dis) =>
  `<div class="row"><span>${name}<small>${sub}</small></span><button class="rot" type="button" data-act="${act}"${dis ? ' disabled' : ''}>${label}</button></div>`;
export function openShop(n){
  G.shopNode = n; tut('shop');
  if (!n.offers){
    const pool = lootPool(); n.offers = [];
    for (let q=0; q<5; q++){ const t = rollBlock(1.6, pool), o = n.offers.find(x => x.t===t); if (o) o.n++; else n.offers.push({t, n:1}); }
  }
  const ups = PAL.filter(t => t!=='sell' && (onShip(t) || G.inv[t] > 0)), rep = repTotal(.5);
  let h = `Credits <b class="gold">${Math.round(G.credits)}</b>. Repairs here cost half.<div class="rows"><h3>Buy</h3>` +
    n.offers.map((o,i) => row(T[o.t].name + (o.n > 1 ? ` ×${o.n}` : ''), T[o.t].desc, o.n ? `${buyPrice(o.t)} cr` : 'sold', `buy:${i}`, !o.n || buyPrice(o.t) > G.credits)).join('');
  if (G.broken.size) h += `<h3>Repair</h3>` + row(`${G.broken.size} damaged block${G.broken.size>1?'s':''}`, 'Fixes as many as you can afford.', `${rep} cr`, 'rep:0', !canRepair(.5));
  h += `<h3>Upgrade</h3>` + (ups.length ? ups.map(t => row(`${T[t].name} Lv${lvOf(t)}`, lvOf(t) < MAXLV ? `+35% to every ${T[t].name.toLowerCase()} block.` : 'Fully upgraded.',
    lvOf(t) < MAXLV ? `${upCost(t)} cr` : 'max', `up:${t}`, lvOf(t) >= MAXLV || upCost(t) > G.credits)).join('') : '<small>Nothing to upgrade.</small>');
  const cargo = cargoTypes();
  h += `<h3>Sell from cargo</h3>` + (cargo.length ? cargo.map(t => row(`${T[t].name} ×${G.inv[t]}${dmgOf(t) ? ` (${dmgOf(t)} damaged)` : ''}`, dmgOf(t) ? 'Damaged blocks sell first, at half price.' : 'Only blocks in cargo can be sold. Remove them from the ship in drydock first.', `+${dmgOf(t) ? Math.round(sellPrice(t)/2) : sellPrice(t)} cr`, `sell:${t}`, false)).join('') : '<small>Cargo is empty.</small>');
  h += '</div>';
  const top = $('overlay').hidden ? 0 : $('ovText').closest('.card').scrollTop;
  showOverlay('Shop', h, [['Leave', toMap], ['Drydock', toDrydock, 'ghost']], true);
  $('ovText').closest('.card').scrollTop = top;
}
export function canRepair(mul){ return [...G.broken].some(k => G.design.has(k) && Math.ceil(repCost(G.design.get(k))*mul) <= G.credits); }
export const ACT = {
  buy: i => { const o = G.shopNode.offers[i], c = buyPrice(o.t); if (!o.n || c > G.credits) return; G.credits -= c; o.n--; addBlock(o.t); sfx('place'); },
  up: t => { const c = upCost(t); if (lvOf(t) >= MAXLV || c > G.credits) return; G.credits -= c; G.lv[t] = lvOf(t) + 1; sfx('upgrade'); },
  rep: () => { if (repair(.5)) sfx('upgrade'); },
  sell: t => { if (!(G.inv[t] > 0)) return; G.credits += takeCargo(t, true) ? Math.round(sellPrice(t)/2) : sellPrice(t); sfx('place'); },
  pick: t => { if (G.pick) G.pick(t); return true; },
  meta: id => { const m = META.find(x => x.id===id); if (!m || metaLv(id) >= m.max || metaCost(m) > G.meta.data) return; G.meta.data -= metaCost(m); G.meta.lv[id] = metaLv(id) + 1; saveMeta(); sfx('upgrade'); showTitle(); return true; },
};
