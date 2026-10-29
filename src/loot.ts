import { sfx } from './audio';
import { MAXLV, PAL, PLATE, RARITY, T, blurb, lvOf, onShip, owned, rarName, rarOf, repCost, unlocked } from './catalog';
import { startFight } from './fights';
import { CORE, rand } from './grid';
import { metaLv } from './runs';
import { save } from './save';
import { toMap } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import type { BlockType, MapNode } from './types';
import { icon, showOverlay } from './ui';

// ---------- loot ----------
export const lootPool = () => PAL.filter(t => t!=='sell' && !PLATE(t) && unlocked(t));
// Odds by rarity: the rarity is rolled first, then a block of that rarity, evenly, so a rarity with many blocks
// is no likelier than one with few. Each step up is rarer, but deeper sectors, better sources (boost) and the hangar's
// prototype access multiply every step, up to a cap per rarity: at the caps it is 55% common, 28% uncommon,
// 12% rare, 4% epic and 1% legendary.
const RW = [100, 40, 12, 3, .8], RCAP = [100, 50, 22, 7, 2];
// epic and up: at most one of these in any pick of three
const TOP = 3;
export function rollBlock(boost=1, pool=lootPool()): BlockType {
  const f = (1 + .1*(G.stage-1))*(1 + .3*(boost-1))*(1 + .12*metaLv('proto'));
  const tiers = RW.map((_, r) => pool.filter(t => rarOf(t)===r));
  const w = tiers.map((ts, r) => ts.length ? Math.min(RW[r]*Math.pow(f, r), RCAP[r]) : 0);
  let x = Math.random()*w.reduce((a,b) => a+b, 0);
  for (let r=0; r<w.length; r++) if (w[r] && (x -= w[r]) < 0) return tiers[r][Math.floor(Math.random()*tiers[r].length)];
  return pool[0];
}
// G.dmg[t] of the G.inv[t] blocks in cargo are damaged. Taking one uses an intact block first (or a damaged one first, for selling); returns whether it was damaged.
export const dmgOf = (t: BlockType) => Math.min(G.dmg[t]||0, G.inv[t]||0);
export function takeCargo(t: BlockType, damagedFirst=false){
  const have = G.inv[t] || 0, d = dmgOf(t), hurt = damagedFirst ? d > 0 : have - d <= 0;
  G.inv[t] = have - 1; G.dmg[t] = hurt ? d - 1 : Math.min(d, have - 1);
  return hurt;
}
export function addBlock(t: BlockType, n=1){ if (!owned(t)) G.fresh.add(t); G.inv[t] = (G.inv[t]||0) + n; }
export function giveLoot(boost: number){ const t = rollBlock(boost); addBlock(t); return t; }
// Loot you choose: each pick offers three different blocks, or skip. done gets the blocks taken.
export function chooseLoot(n: number, boost: number, title: string, intro: string, done: (got: (BlockType | null)[]) => void){
  const got: (BlockType | null)[] = []; tut('loot');
  const step = () => {
    if (got.length >= n) return done(got);
    const offers: BlockType[] = [];
    for (let q=0; offers.length < 3 && q < 30; q++){
      const top = offers.some(o => rarOf(o) >= TOP), t = rollBlock(boost, top ? lootPool().filter(x => rarOf(x) < TOP) : lootPool());
      if (!offers.includes(t)) offers.push(t);
    }
    G.pick = t => { G.pick = null; if (t){ addBlock(t); got.push(t); sfx('place'); } else got.push(null); step(); };
    showOverlay(title, intro + `<div class="rows"><h3>Choose one${n > 1 ? ` · ${got.length+1}/${n}` : ''}</h3></div><div class="picks">` +
      offers.map((t, i) => `<button class="pick" type="button" data-act="pick:${t}" style="--rc:${RARITY[rarOf(t)].col}">${icon(t)}<i>${RARITY[rarOf(t)].name}</i><b>${T[t].name}</b>${T[t].make ? `<small class="mk">${T[t].make}</small>` : ''}` +
        `<small>${blurb(t)}</small>${owned(t) ? '' : '<span class="new">New</span>'}<kbd>${i+1}</kbd></button>`).join('') + '</div>',
      [], true, {eye:'Salvage recovered'});
  };
  step();
}
export const lootText = (got: (BlockType | null)[]) => { const ts = got.filter((t): t is BlockType => !!t); return ts.length ? ` Found: ${ts.map(rarName).join(', ')}.` : ''; };
export const chance = (p: number) => Math.random() < p;
// credit income: every source pays half of what it used to, plus the hangar's salvage rights
export const inc = (v: number) => Math.round(v*.5*(1 + .08*metaLv('salv')));
export const cargoTypes = () => (Object.keys(G.inv) as BlockType[]).filter(t => (G.inv[t] || 0) > 0);
export function damageRandom(n: number){
  const ks = [...G.design.keys()].filter(k => k!==CORE && !G.broken.has(k));
  let c = 0;
  for (; c<n && ks.length; c++){ const i = (Math.random()*ks.length)|0; G.broken.add(ks[i]); ks.splice(i,1); }
  return c;
}
export function upgradeRandom(){
  const ts = PAL.filter(t => t!=='sell' && !T[t].mount && (onShip(t) || (G.inv[t] || 0) > 0) && lvOf(t) < MAXLV);
  if (!ts.length) return null;
  const t = ts[(Math.random()*ts.length)|0]; G.lv[t] = lvOf(t) + 1; return t;
}
export const repTotal = (mul=1) => { let c = 0; for (const k of G.broken){ const t = G.design.get(k); if (t) c += Math.ceil(repCost(t)*mul); } return c; };
// repairs damaged blocks one by one while the credits last; returns how many were fixed
export function repair(mul=1){
  let n = 0;
  for (const k of [...G.broken]){
    const t = G.design.get(k);
    if (!t){ G.broken.delete(k); continue; }
    const c = Math.ceil(repCost(t)*mul); if (c > G.credits) continue;
    G.credits -= c; G.broken.delete(k); n++;
  }
  return n;
}
export function salvage(n: MapNode){
  n.used = true;
  if (chance(.3)){ showOverlay('Wreckage', 'The wreck is bait. Hostiles are closing in.', [['Fight', () => startFight('ambush')]], false, {eye:'Ambush', ac:'var(--foe)'}); return; }
  const cr = inc(rand(15,30) + 6*G.stage), head = `You strip the wreck for <b class="gold">${cr}</b> credits.`;
  G.credits += cr; save();
  chooseLoot(chance(.35) ? 2 : 1, 1, 'Wreckage', head, got => { save(); showOverlay('Wreckage', head + lootText(got), [['Star map', toMap]]); });
}
export function repairDock(n: MapNode){
  n.used = true;
  const c = G.broken.size; G.broken.clear(); sfx('upgrade');
  if (!c) G.credits += 10;
  save();
  showOverlay('Repair dock', c ? `The crew fixes <b>${c}</b> damaged block${c>1?'s':''}, free of charge.` : 'Nothing to fix. The crew pays you <b class="gold">20</b> credits for your spare plating.', [['Star map', toMap]]);
}
