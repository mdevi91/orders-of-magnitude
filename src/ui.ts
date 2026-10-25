import { renderBps } from './blueprints';
import { rangeOf } from './bullets';
import { BEAM, CRAFT, HM, LV, MAXLV, PAL, PARTS, PLATE, RARITY, T, canBuyHere, isCraft, isWeapon, lvOf, outfitPrice, owned, partOffsets, rarOf } from './catalog';
import { aimsOut, arcClear, designType, drawBlock } from './draw';
import { ARROW, BS, CORE, FA, FACING, KI, KJ, MIRROR } from './grid';
import { renderGroups } from './groups';
import { undoStack } from './input';
import { dmgOf, repTotal } from './loot';
import { dirSpeed, laneFwd, physics } from './physics';
import { save } from './save';
import { LIFE } from './ships';
import { ACT, canRepair, openShop } from './shop';
import { NODE, canJump, curNode, exitNode, nodeDef } from './starmap';
import { G, blockCount, buildR, scaleOf, turnOf } from './state';
import type { BlockType } from './types';
import { $ } from './view';

// ---------- UI ----------
// The parts palette, in groups; a group's heading hides while none of its blocks are available.
const GROUPS = [['Structure', (t: BlockType) => t==='sell' || PLATE(t)], ['Weapons', (t: BlockType) => isWeapon(t)], ['Hangars', (t: BlockType) => isCraft(t)], ['Systems', () => true]] as const;
const groupOf = (t: BlockType) => GROUPS.findIndex(([,f]) => f(t));
export function buildPalette(){
  const root = $('palette');
  GROUPS.forEach(([name], n) => {
    const h = document.createElement('h3'); h.className = 'palh'; h.id = 'palh-'+n; h.textContent = name;
    const g = document.createElement('div'); g.className = 'palg'; g.id = 'palg-'+n;
    root.append(h, g);
  });
  for (const t of PAL){
    const el = $('palg-'+groupOf(t));
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pal'; b.id = 'pal-'+t; b.title = T[t].desc || '';
    if (t!=='sell' && !PLATE(t)) b.style.setProperty('--rc', RARITY[rarOf(t)].col);
    const ic = document.createElement('canvas'); ic.width = ic.height = 14; ic.id = 'ic-'+t;
    const sp = document.createElement('span');
    sp.innerHTML = `<span class="nm">${T[t].name}</span><span class="ct" id="ct-${t}"></span>`;
    const kb = document.createElement('kbd'); kb.textContent = (T[t].key || '').toUpperCase();
    b.append(ic, sp, kb);
    b.addEventListener('click', () => select(t));
    el.append(b);
  }
}
export function drawIcons(){
  for (const t of PAL){
    const ic = $<HTMLCanvasElement>('ic-'+t), g = ic.getContext('2d')!, o = T[t].rot ? G.rot : 0;
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,14,14);
    g.setTransform(14/12,0,0,14/12,7,7); g.lineWidth = 12/14;
    drawBlock(g, t, o, 'p', 0, 0, FA[o], false, 1, t==='engine');
  }
  const t = G.sel, o = T[t].rot ? G.rot : 0, g = $<HTMLCanvasElement>('selIc').getContext('2d')!;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,14,14);
  g.setTransform(14/12,0,0,14/12,7,7); g.lineWidth = 12/14;
  drawBlock(g, t, o, 'p', 0, 0, FA[o], false, 1, t==='engine');
}
// The inspector card for the selected part: what it is, what it does, what it costs and where it comes from.
function syncSelCard(S: number){
  const t = G.sel, d = T[t], plate = PLATE(t), rg = rangeOf(t), have = G.inv[t] || 0, L = lvOf(t);
  $('selName').textContent = d.name;
  $('selName').style.color = t==='sell' || plate ? '' : RARITY[rarOf(t)].col;
  $('selRar').textContent = t==='sell' ? 'Tool' : plate ? 'Plating' : RARITY[rarOf(t)].name;
  $('selDesc').textContent = (d.desc || '') + (d.rot && !PARTS[t] ? ' Tap a placed one to turn it 45°.' : '');
  const row = (k: string, v: string) => `<dt>${k}</dt><dd>${v}</dd>`;
  $('selStats').innerHTML = t==='sell' ? '' :
    row('Source', plate ? `${d.cost} cr each` : have ? `${have} in cargo` + (dmgOf(t) ? ` (${dmgOf(t)} damaged)` : '') : canBuyHere(t) ? `${outfitPrice(t)} cr each` : 'none in cargo') +
    (d.hp ? row('Hit points', String(Math.round(d.hp*LV(t)*HM.hp()))) : '') +
    (rg ? row('Range', `${Math.round(rg*Math.pow(S,.8)/BS)} m`) : '') +
    row('Level', `${L} / ${MAXLV}`) +
    (PARTS[t] ? row('Size', `${partOffsets(PARTS[t]!).length} cells`) : '');
}
export function select(t: BlockType){
  if (!owned(t)) return; // blocks you have never found stay secret
  G.sel = t; G.grpBrush = 0; if (PARTS[t]) G.rot &= ~1; syncUI();
}
export function designStats(){
  const cells = [...G.design].map(([k,t]) => ({t, i:KI(k), j:KJ(k), o:G.dirs.get(k)||0}));
  const ph = physics(cells, designType);
  let dps = 0, hp = 0, pd = 0, sh = 0, fb = 0, bb = 0, badW = 0, badT = 0, weakT = 0, eGen = 6, eCap = 40, eUse = 0;
  for (const c of cells){
    const d = T[c.t], m = LV(c.t); hp += (d.hp || 0)*m;
    if (aimsOut(c.t)){ const fc = arcClear(c.i, c.j, c.o, c.t); if (fc === 0) badT++; else if (fc < .4) weakT++; }
    if (d.gun) dps += d.gun.dmg*(d.gun.mirv || 1)*(d.gun.pellets || 1)*m/d.gun.cd;
    if (d.tesla){ dps += d.tesla.dmg*d.tesla.jumps*m/d.tesla.cd; eUse += d.tesla.en/d.tesla.cd; }
    if (d.gun && d.gun.en) eUse += d.gun.en/d.gun.cd;
    if (d.laser) eUse += d.laser.en; if (d.rail) eUse += d.rail.en/d.rail.cd; if (d.pd) eUse += d.pd.en/d.pd.cd*m;
    if (d.en?.regen) eGen += d.en.regen*m; if (d.en?.cap) eCap += d.en.cap*m;
    if (d.pd) pd++;
    if (c.t==='shield') sh++;
    if (isCraft(c.t)){ dps += CRAFT[c.t].gun.dmg/CRAFT[c.t].gun.cd*m; if (c.t==='fbay') fb++; else bb++; }
    if (BEAM(c.t)){
      if (!laneFwd(designType, c.i, c.j, c.o)) badW++;
      else dps += (d.rail ? d.rail.pool/d.rail.cd : d.laser ? d.laser.dps*.6 : 0)*m;
    }
  }
  // hangar upgrades apply on top of block levels
  return {n:cells.length, hp:hp*HM.hp(), dps:dps*HM.dmg(), pd, sh, fb, bb, badW, badT, weakT, eGen:eGen*HM.en(), eCap:eCap*HM.en(), eUse, badE:ph.engines.filter(e => !e.active).length,
    fore:dirSpeed(ph,0,-1), side:Math.max(dirSpeed(ph,1,0), dirSpeed(ph,-1,0)), aft:dirSpeed(ph,0,1),
    turn:turnOf(ph.torque + (ph.jetCW+ph.jetCCW)/2, ph.inertia, ph.mass)};
}
export function syncUI(){
  const s = G.stage, R = buildR(), S = scaleOf(s);
  for (const t of PAL){
    const btn = $<HTMLButtonElement>('pal-'+t), ct = $('ct-'+t), have = G.inv[t] || 0;
    btn.setAttribute('aria-pressed', String(G.sel===t)); btn.hidden = !owned(t);
    const buy = !have && canBuyHere(t);
    ct.textContent = t==='sell' ? 'to cargo' : PLATE(t) ? T[t].cost+' cr' + (lvOf(t) > 1 ? ` · Lv${lvOf(t)}` : '') : buy ? `${outfitPrice(t)} cr` : `×${have}` + (dmgOf(t) ? ` (${dmgOf(t)} dmg)` : '') + (lvOf(t) > 1 ? ` · Lv${lvOf(t)}` : '');
    ct.classList.toggle('no', t!=='sell' && (PLATE(t) ? T[t].cost > G.credits : buy ? outfitPrice(t) > G.credits : !have));
  }
  if (!owned(G.sel)) G.sel = 'hull';
  const rotOk = !!T[G.sel].rot;
  $<HTMLButtonElement>('rot').disabled = !rotOk; drawIcons();
  $('mirName').textContent = MIRROR[G.mir];
  $<HTMLButtonElement>('undo').disabled = !undoStack.length; renderBps(); renderGroups();
  $('rotArrow').textContent = ARROW[G.rot]; $('rotName').textContent = FACING[G.rot];
  $('rot').title = rotOk ? 'Facing for the next block. Tip: tap a placed block of this type to turn it.' : 'This block has no facing';
  syncSelCard(S);
  GROUPS.forEach((_, n) => { $('palh-'+n).hidden = !PAL.some(t => groupOf(t)===n && owned(t)); });
  const rb = $<HTMLButtonElement>('repair');
  rb.hidden = !G.broken.size; rb.disabled = !canRepair(1);
  rb.innerHTML = `Repair ${G.broken.size} damaged · ${repTotal()} cr`;
  $('gridInfo').innerHTML = G.outfit ? `<b class="gold">Outfitting.</b> Every unlocked block is for sale: buy as many as your <b class="gold">${Math.round(G.credits)} cr</b> allow. What you don't spend carries into the run.`
    : `Sector <b>${s}</b>. Plating costs credits; every other block comes from cargo. Upgrades are sold at shops.`;
  const st = designStats(), ms = (v: number) => (v/BS).toFixed(1);
  const warn = [st.badE ? `${st.badE} engine${st.badE>1?'s':''}` : '', st.badW ? `${st.badW} beam weapon${st.badW>1?'s':''}` : '', st.badT ? `${st.badT} turret${st.badT>1?'s':''}` : ''].filter(Boolean).join(', ');
  $('stats').innerHTML =
    `<dt>Blocks</dt><dd>${blockCount()}</dd><dt>Structure</dt><dd>${Math.round(st.hp)} hp</dd><dt>Life</dt><dd>${Math.round(st.hp*LIFE)}</dd><dt>Firepower</dt><dd>${Math.round(st.dps)} dmg/s</dd>` +
    `<dt>Speed fore</dt><dd>${ms(st.fore)} m/s</dd><dt>Speed side / aft</dt><dd>${ms(st.side)} / ${ms(st.aft)}</dd>` +
    `<dt>Energy</dt><dd class="${st.eUse > st.eGen ? 'gold' : ''}">+${Math.round(st.eGen)}/s · uses ${Math.round(st.eUse)}/s · ${Math.round(st.eCap)}</dd>` +
    `<dt>Turn rate</dt><dd>${Math.round(st.turn*180/Math.PI)}°/s</dd><dt>Shields / PD</dt><dd>${st.sh} / ${st.pd}</dd>` +
    (st.fb || st.bb ? `<dt>Fighters / bombers</dt><dd>${st.fb} / ${st.bb}</dd>` : '') +
    (G.broken.size ? `<dt class="warn">Damaged</dt><dd class="warn">${G.broken.size} block${G.broken.size>1?'s':''}</dd>` : '') +
    (warn ? `<dt class="warn">Blocked</dt><dd class="warn">${warn}</dd>` : '') +
    (st.weakT ? `<dt class="gold">Boxed in</dt><dd class="gold">${st.weakT} turret${st.weakT>1?'s':''}</dd>` : '');
  $('launch').textContent = G.outfit ? 'Start run' : 'Star map';
  const m = G.mode, fight = m==='combat' || ((m==='clear' || m==='dead') && G.player);
  $('panel').hidden = $('inspect').hidden = m!=='build'; $('mapPanel').hidden = m!=='map';
  $('hudWave').hidden = !fight; $('coreWrap').hidden = !fight; $('pauseBtn').hidden = !fight; $('aimBtn').hidden = !fight; $('zoomIn').hidden = $('zoomOut').hidden = !fight; $('groups').hidden = !fight;
  if (m==='map') syncMapPanel();
  hudCache = {};
  if (m==='build' || m==='map') save();
}
export function syncMapPanel(){
  if (!G.map) return;
  const cur = curNode(), h = G.mapHover, nb = G.broken.size, cargo = Object.values(G.inv).reduce((a,b) => a + b, 0);
  $('mapTitle').textContent = `Sector ${G.stage}`;
  const lead = h ? `<b>${nodeDef(h.type).name}.</b> ${nodeDef(h.type).desc}${canJump(h) ? ' Click to jump.' : ''}`
    : exitNode(cur) ? (G.map.done ? 'The gate is open.' : `The ${nodeDef(cur.type).name.toLowerCase()} blocks the way out.`)
    : `Pick a lit beacon to jump to. ${G.stage%3===0 ? 'A flagship guards this sector.' : `Flagship in sector ${Math.ceil(G.stage/3)*3}.`}`;
  $('mapInfo').innerHTML = lead + `<br>Cargo <b>${cargo}</b> block${cargo===1 ? '' : 's'}` + (nb ? `, <b style="color:var(--foe)">${nb} damaged</b>` : '') + '.';
  let lbl = '';
  if (exitNode(cur)) lbl = G.map.done ? `Jump to sector ${G.stage+1}` : `Engage ${nodeDef(cur.type).name.toLowerCase()}`;
  else if (cur.type==='shop') lbl = 'Open shop';
  else if (cur.type==='event' && !cur.used) lbl = 'Answer the signal';
  $('mapGo').hidden = !lbl; $('mapGo').textContent = lbl;
}
export let hudCache: Record<string, string | boolean> = {};
export function setTxt(id: string, v: string){ if (hudCache[id] !== v){ hudCache[id] = v; $(id).textContent = v; } }
export function syncHud(){
  setTxt('hudStage', `Sector ${G.stage}`);
  setTxt('hudCredits', String(Math.round(G.credits)));
  const B = G.mode==='combat' && G.boss && G.boss.alive ? G.boss : null;
  if (hudCache.boss !== !!B){ hudCache.boss = !!B; $('bossWrap').hidden = !B; }
  if (B){
    setTxt('bossName', B.flag ? `${B.station ? 'Starbase' : 'Flagship'} · phase ${B.phaseN}` : 'Capital ship');
    const bw = (100*Math.max(0, B.life/B.lifeMax)).toFixed(0)+'%';
    if (hudCache.bw !== bw){ hudCache.bw = bw; $('bossBar').style.width = bw; }
  }
  if (G.mode!=='build' && G.mode!=='map' && G.mode!=='title' && G.player){
    const alive = G.ships.filter(s => s.alive && s.team==='e' && !s.fodder).length;
    setTxt('hudWave', `${NODE[G.fight].name} · wave ${G.waveIdx}/${G.waves.length} · ${alive} hostile${alive===1 ? '' : 's'}`);
    const core = G.player.blocks.get(CORE), pct = core ? Math.max(0, core.hp/core.max) : 0;
    const w = (pct*100).toFixed(0)+'%';
    const ew = (Math.max(0, G.player.en/G.player.enMax)*100).toFixed(0)+'%', lp = Math.max(0, G.player.life/G.player.lifeMax), lw = (lp*100).toFixed(0)+'%';
    if (hudCache.life !== lw){ hudCache.life = lw; const bar = $('lifeBar'); bar.style.width = lw; bar.style.background = lp < .35 ? 'var(--foe)' : ''; }
    if (hudCache.en !== ew){ hudCache.en = ew; $('enBar').style.width = ew; }
    if (hudCache.core !== w){ hudCache.core = w; const bar = $('coreBar'); bar.style.width = w; bar.style.background = pct < .35 ? 'var(--foe)' : ''; }
  }
}
/** An overlay button: label, handler, and an optional class ('ghost' for the quiet style). */
export type OverlayAction = [string, () => void, string?];
export function showOverlay(title: string, html: string, actions: OverlayAction[], wide=false){
  $('ovTitle').textContent = title; $('ovText').innerHTML = html; menuCard(false);
  $('ovTitle').closest('.card')!.classList.toggle('wide', wide);
  const a = $('ovActions'); a.innerHTML = '';
  for (const [label, fn, cls] of actions){ const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); a.append(b); }
  $('overlay').hidden = false; (a.firstChild as HTMLElement | null)?.focus();
}
/** The main menu stacks its buttons in a column. */
export function menuCard(on: boolean){ $('ovTitle').closest('.card')!.classList.toggle('menu', on); }
export function hideOverlay(){ $('overlay').hidden = true; }
export let toastTimer = 0;
export function toast(msg: string){ const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 1600); }

// wiring that runs once at start-up
export function init(){
  // shop and hangar buttons inside the overlay text
  $('ovText').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-act]'); if (!b || b.disabled) return;
    const [k, v] = (b.dataset.act || '').split(':');
    if (ACT[k](v)) return;
    save(); openShop(G.shopNode!);
  });
}
