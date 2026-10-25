import { sfx } from './audio';
import { MAXLV, PAL, RARITY, T, blurb, lvOf, lvStep, onShip, priceMul, rarOf, repCost, upCost } from './catalog';
import { addBlock, cargoTypes, dmgOf, lootPool, repTotal, repair, rollBlock, takeCargo } from './loot';
import { META, metaCost, metaLv, showRnD } from './runs';
import { saveMeta } from './save';
import { toDrydock, toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import { icon, pips, showOverlay } from './ui';
import type { BlockType, MapNode } from './types';
import { $ } from './view';

// ---------- shop ----------
export const buyPrice = (t: BlockType) => Math.round(T[t].cost*1.1*priceMul());
export const sellPrice = (t: BlockType) => Math.round(T[t].cost*.45);
export const row = (name: string, sub: string, label: string, act: string, dis?: boolean, ic = '') =>
  `<div class="row">${ic}<span>${name}<small>${sub}</small></span><button class="rot" type="button" data-act="${act}"${dis ? ' disabled' : ''}>${label}</button></div>`;
/** A tile: icon, name and tag line, description, then a footer (a level bar, a count) beside its button. rc colours its top edge. */
export interface Tile { ic?: string; rc?: string; name: string; tag: string; desc: string; foot?: string; label: string; act: string; dis?: boolean; locked?: boolean }
export const tile = (o: Tile) => `<div class="tile${o.locked ? ' locked' : ''}"${o.rc ? ` style="--rc:${o.rc}"` : ''}><div class="th">${o.ic || ''}<span><b>${o.name}</b><i>${o.tag}</i></span></div><p>${o.desc}</p>` +
  (o.label ? `<div class="tf"><span>${o.foot || ''}</span><button class="rot" type="button" data-act="${o.act}"${o.dis ? ' disabled' : ''}>${o.label}</button></div>` : o.foot ? `<div class="tf">${o.foot}</div>` : '') + '</div>';
export function openShop(n: MapNode){
  G.shopNode = n; tut('shop');
  const offers = n.offers ??= [];
  if (!offers.length){
    const pool = lootPool();
    for (let q=0; q<5; q++){ const t = rollBlock(1.6, pool), o = offers.find(x => x.t===t); if (o) o.n++; else offers.push({t, n:1}); }
  }
  const ups = PAL.filter(t => t!=='sell' && (onShip(t) || (G.inv[t] || 0) > 0)), rep = repTotal(.5);
  let h = `<div class="readouts"><div class="readout"><b class="gold">${Math.round(G.credits)}</b><span>Credits</span></div><div class="readout"><b>${offers.reduce((a, o) => a + o.n, 0)}</b><span>In stock</span></div>` +
    `<div class="readout"><b>${G.broken.size}</b><span>Damaged</span></div></div><div class="rows"><h3>Stock</h3></div><div class="tiles">` +
    offers.map((o,i) => tile({ic:icon(o.t), rc:RARITY[rarOf(o.t)].col, name:T[o.t].name, tag:RARITY[rarOf(o.t)].name + (T[o.t].make ? ' · ' + T[o.t].make : ''), desc:blurb(o.t), foot:o.n ? `×${o.n} left` : 'Sold out',
      label:o.n ? `${buyPrice(o.t)} cr` : 'sold', act:`buy:${i}`, dis:!o.n || buyPrice(o.t) > G.credits})).join('') + '</div><div class="rows">';
  if (G.broken.size) h += `<h3>Repair · half price here</h3>` + row(`${G.broken.size} damaged block${G.broken.size>1?'s':''}`, 'Fixes as many as you can afford.', `${rep} cr`, 'rep:0', !canRepair(.5));
  h += `<h3>Upgrade</h3>` + (ups.length ? ups.map(t => row(`${T[t].name} ${pips(lvOf(t), MAXLV)}`, lvOf(t) < MAXLV ? `+${lvStep(lvOf(t))}% to every ${T[t].name.toLowerCase()} block.` : 'Fully upgraded.',
    lvOf(t) < MAXLV ? `${upCost(t)} cr` : 'max', `up:${t}`, lvOf(t) >= MAXLV || upCost(t) > G.credits, icon(t))).join('') : '<small>Nothing to upgrade.</small>');
  const cargo = cargoTypes();
  h += `<h3>Sell from cargo</h3>` + (cargo.length ? cargo.map(t => row(`${T[t].name} ×${G.inv[t]}${dmgOf(t) ? ` (${dmgOf(t)} damaged)` : ''}`, dmgOf(t) ? 'Damaged blocks sell first, at half price.' : 'Only blocks in cargo can be sold. Remove them from the ship in drydock first.', `+${dmgOf(t) ? Math.round(sellPrice(t)/2) : sellPrice(t)} cr`, `sell:${t}`, false, icon(t))).join('') : '<small>Cargo is empty.</small>');
  h += '</div>';
  // keep the scroll position when the shop redraws after a purchase
  const card = () => $('ovText').closest('.card')!, top = $('overlay').hidden ? 0 : card().scrollTop;
  showOverlay('Trading post', h, [['Leave', toMap], ['Drydock', toDrydock, 'ghost']], true, {eye:`Sector ${G.stage} · Market`, ac:'var(--gold)'});
  card().scrollTop = top;
}
export function canRepair(mul: number){ return [...G.broken].some(k => { const t = G.design.get(k); return !!t && Math.ceil(repCost(t)*mul) <= G.credits; }); }
/** Buttons inside overlays (shop, loot picks, hangar), by the action name in their data-act. Return true when the handler redraws the overlay itself. */
export const ACT: Record<string, (v: string) => boolean | void> = {
  buy: i => { const o = G.shopNode!.offers![+i], c = buyPrice(o.t); if (!o.n || c > G.credits) return; G.credits -= c; o.n--; addBlock(o.t); sfx('place'); },
  up: v => { const t = v as BlockType, c = upCost(t); if (lvOf(t) >= MAXLV || c > G.credits) return; G.credits -= c; G.lv[t] = lvOf(t) + 1; sfx('upgrade'); },
  rep: () => { if (repair(.5)) sfx('upgrade'); },
  sell: v => { const t = v as BlockType; if (!((G.inv[t] || 0) > 0)) return; G.credits += takeCargo(t, true) ? Math.round(sellPrice(t)/2) : sellPrice(t); sfx('place'); },
  pick: v => { if (G.pick) G.pick(v as BlockType); return true; },
  meta: id => { const m = META.find(x => x.id===id); if (!m || metaLv(id) >= m.max || metaCost(m) > G.meta.data) return; G.meta.data -= metaCost(m); G.meta.lv[id] = metaLv(id) + 1; saveMeta(); sfx('upgrade'); showRnD(); return true; },
};
