import { sfx } from './audio';
import { MAXLV, PAL, RARITY, T, blurb, lvGain, lvOf, onShip, priceMul, rarOf, repCost, upCost } from './catalog';
import { addBlock, cargoTypes, dmgOf, lootPool, repTotal, repair, rollBlock, takeCargo } from './loot';
import { flipOption } from './options';
import { META, metaCost, metaLv, showRnD } from './runs';
import { saveMeta } from './save';
import { toDrydock, toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import { hexo, icon, pad2, showOverlay } from './ui';
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
  const ups = PAL.filter(t => t!=='sell' && !T[t].mount && (onShip(t) || (G.inv[t] || 0) > 0)), rep = repTotal(.5), stock = offers.reduce((a, o) => a + o.n, 0), cargo = cargoTypes();
  // full screen: title and hexagon readouts across the top, stock on the left, repair, upgrades and selling on the right
  const tag = (t: string, cls = '') => `<span class="stag ${cls}">${t}</span>`, low = (t: BlockType) => T[t].name.toLowerCase();
  let s = `<div class="scr-head"><div class="scr-title">${tag('Trading post', 'fill')}${tag(`Sector ${pad2(G.stage)}`)}<h2>Shop</h2></div>` +
    `<div class="hexes">${hexo('Credits', Math.round(G.credits), 'fill')}${hexo('In stock', pad2(stock))}${hexo('Damaged', pad2(G.broken.size), G.broken.size ? 'red' : '')}</div></div>` +
    `<div class="scr-cols"><div class="scr-main"><h3>Stock <small>Prices in cr</small></h3>` +
    offers.map((o, i) => `<div class="sitem">${icon(o.t)}<div class="si-name"><b>${T[o.t].name}</b>${T[o.t].make ? `<i>${T[o.t].make}</i>` : ''}<em style="--rc:${RARITY[rarOf(o.t)].col}">${RARITY[rarOf(o.t)].name}</em><small>${blurb(o.t)}</small></div>` +
      `<div class="si-price"><b>${buyPrice(o.t)} cr</b><small>${o.n ? `×${o.n} left` : 'sold out'}</small></div><button class="buy" type="button" data-act="buy:${i}"${!o.n || buyPrice(o.t) > G.credits ? ' disabled' : ''}>Buy</button></div>`).join('') +
    '</div><div class="scr-side">';
  if (G.broken.size) s += `<div class="warnbox"><div>${tag('Warning', 'red')}<span>${G.broken.size} damaged block${G.broken.size > 1 ? 's' : ''}</span></div><button class="buy red" type="button" data-act="rep:0"${canRepair(.5) ? '' : ' disabled'}>Repair ${rep} cr</button></div>`;
  s += '<h3>Upgrades <small>Permanent this run</small></h3>' + (ups.length ? ups.map(t => `<div class="sup">${icon(t)}<div><b>${T[t].name} <i>Lv ${lvOf(t)}${lvOf(t) < MAXLV ? ` → ${lvOf(t) + 1}` : ''}</i></b><small>${lvOf(t) < MAXLV ? `Every ${low(t)}: ${lvGain(t)}` : 'fully upgraded'}</small></div>` +
    `<button class="rot" type="button" data-act="up:${t}"${lvOf(t) >= MAXLV || upCost(t) > G.credits ? ' disabled' : ''}>${lvOf(t) < MAXLV ? `${upCost(t)} cr` : 'max'}</button></div>`).join('') : '<p class="log">&gt; NOTHING TO UPGRADE</p>');
  s += '<h3>Sell <small>From cargo</small></h3>' + (cargo.length ? cargo.map(t => `<div class="sup">${icon(t)}<div><b>${T[t].name} <i>×${G.inv[t]}</i></b>${dmgOf(t) ? `<small>${dmgOf(t)} damaged, sold first at half price</small>` : ''}</div>` +
    `<button class="rot" type="button" data-act="sell:${t}">+${dmgOf(t) ? Math.round(sellPrice(t)/2) : sellPrice(t)} cr</button></div>`).join('') : '<p class="log">&gt; CARGO HOLD EMPTY</p>');
  s += `<p class="log">&gt; DOCKING CLAMPS ENGAGED<br>&gt; CARGO ${cargo.reduce((a, t) => a + (G.inv[t] || 0), 0)} BLK · CR ${Math.round(G.credits)}</p></div></div>`;
  // keep the scroll position when the shop redraws after a purchase
  const card = () => $('ovText').closest('.card')!, top = $('overlay').hidden ? 0 : card().scrollTop;
  showOverlay('Trading post', s, [['Leave', toMap], ['Open drydock', toDrydock, 'ghost']], true, {screen:'shop', ac:'var(--line)'});
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
  opt: id => { flipOption(id); return true; },
  meta: id => { const m = META.find(x => x.id===id); if (!m || metaLv(id) >= m.max || metaCost(m) > G.meta.data) return; G.meta.data -= metaCost(m); G.meta.lv[id] = metaLv(id) + 1; saveMeta(); sfx('upgrade'); showRnD(); return true; },
};
