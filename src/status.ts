import { CRAFT, GCOL, T, cockpit, def, grpOf, isCraft } from './catalog';
import { K, clamp } from './grid';
import { G } from './state';
import type { Block, GunDef, Ship } from './types';
import { hctx } from './view';

// The systems readout, bottom right in a fight: every weapon's reload, each shield bubble, each hangar bay and the cockpit ability,
// as small tiles in the menus' black, orange and red.
const ORG = '#ff8a00', RED = '#ff3b2f', PAPER = '#fff4e6', MUTED = '#ffb066', INK = '#000000';
const COND = (s: number) => `600 ${s}px Oswald, "Arial Narrow", sans-serif`, MONO = (s: number) => `700 ${s}px "Roboto Mono", monospace`;
const short = (name: string) => {
  const w = name.split(' ');
  return (w.find(q => q.length > 2 && q === q.toUpperCase() && !/\d/.test(q)) || w[0]).toUpperCase();
};
const gunOf = (b: Block): GunDef | undefined => b.t==='core' ? cockpit().gun : def(b.t)?.gun;
// the longest wait seen for each bay, so its bar can fill from empty
const bayMax = new WeakMap<Block, number>();

interface Tile { lab: string; sub: string; fill: number; state: 'ok' | 'wait' | 'out' | 'live'; gc?: string; hurt?: boolean }
interface Sect { name: string; tiles: Tile[] }

function sections(p: Ship): Sect[] {
  const out: Sect[] = [];
  // cockpit ability
  const C = cockpit(), ab = G.abT <= 0;
  out.push({name:'Cockpit', tiles:[{lab:C.abName.split(':')[0].toUpperCase(), sub:ab ? 'READY' : G.abT.toFixed(1), fill:ab ? 1 : 1 - clamp(G.abT/C.abCd, 0, 1), state:ab ? 'ok' : 'wait'}]});
  // weapons, one tile each, numbered within their type
  const arm: Tile[] = [], seen = new Map<string, number>();
  const num = (t: string) => { const n = (seen.get(t) || 0) + 1; seen.set(t, n); return n; };
  const hurt = (b: Block) => b.hp < b.max*.5;
  const gc = (b: Block) => GCOL[grpOf(K(b.i,b.j), b.t) - 1];
  for (const b of p.guns){
    const g = gunOf(b); if (!g) continue;
    const base = g.cd || 1, f = 1 - clamp(b.cd/base, 0, 1), rdy = b.cd <= 0;
    arm.push({lab:b.t==='core' ? 'CORE GUN' : `${short(T[b.t as keyof typeof T].name)} ${num(b.t)}`, sub:rdy ? 'RDY' : b.cd.toFixed(1), fill:f, state:rdy ? 'ok' : 'wait', gc:gc(b), hurt:hurt(b)});
  }
  const RG = T.rail.rail!;
  for (const b of p.rails){
    const chg = !!b.chg && G.time < b.chg, rdy = b.cd <= 0 && !chg;
    arm.push({lab:`RAIL ${num('rail')}`, sub:chg ? 'CHARGE' : rdy ? 'RDY' : b.cd.toFixed(1), fill:chg ? 1 : 1 - clamp(b.cd/RG.cd, 0, 1), state:chg ? 'live' : rdy ? 'ok' : 'wait', gc:gc(b), hurt:hurt(b)});
  }
  for (const b of p.lasers){ const ok = b.lane || b.t==='glimmer'; arm.push({lab:b.t==='glimmer' ? `GLIMMER ${num('glimmer')}` : `LASER ${num('laser')}`, sub:b.beam ? 'BEAM' : ok ? 'RDY' : 'BLOCKED', fill:1, state:b.beam ? 'live' : ok ? 'ok' : 'out', gc:gc(b), hurt:hurt(b)}); }
  const TS = T.tesla.tesla!;
  for (const b of p.teslas){ const rdy = b.cd <= 0; arm.push({lab:`STORMCOIL ${num('tesla')}`, sub:rdy ? 'RDY' : b.cd.toFixed(1), fill:1 - clamp(b.cd/TS.cd, 0, 1), state:rdy ? 'ok' : 'wait', gc:gc(b), hurt:hurt(b)}); }
  if (arm.length) out.push({name:'Armament', tiles:arm});
  // defense: each shield bubble, then point defense as one tile
  const dfn: Tile[] = [], SH = T.shield.sh!;
  p.shields.forEach((b, n) => {
    const B = b.bub; if (!B) return;
    dfn.push(B.down > 0
      ? {lab:`SHIELD ${n+1}`, sub:'DOWN ' + B.down.toFixed(1), fill:1 - clamp(B.down/SH.down, 0, 1), state:'out', hurt:hurt(b)}
      : {lab:`SHIELD ${n+1}`, sub:Math.ceil(B.hp) + '/' + Math.round(B.max), fill:B.hp/B.max, state:B.hp < B.max ? 'wait' : 'ok', hurt:hurt(b)});
  });
  if (p.pds.length){ const r = p.pds.filter(b => b.cd <= 0).length; dfn.push({lab:p.pds.some(b => b.t==='aegis') ? 'POINT DEF / AEGIS' : 'POINT DEFENSE', sub:`${r}/${p.pds.length} RDY`, fill:r/p.pds.length, state:r ? 'ok' : 'wait'}); }
  if (dfn.length) out.push({name:'Defense', tiles:dfn});
  // hangar: each bay's craft out (its hull), or the wait until the next launch
  const hg: Tile[] = [];
  for (const b of p.bays){
    const kind = isCraft(b.t) ? b.t : 'fbay', lab = `${kind==='bbay' ? 'BOMBER' : 'FIGHTER'} ${num(kind)}`;
    const A = b.ally;
    if (A && A.alive){ hg.push({lab, sub:'SORTIE', fill:clamp(A.life/A.lifeMax, 0, 1), state:'live', hurt:hurt(b)}); continue; }
    const t = Math.max(0, b.bt || 0); if (t > (bayMax.get(b) || 0) || t <= 0) bayMax.set(b, Math.max(t, CRAFT[kind].rearm));
    hg.push({lab, sub:t > 0 ? 'REARM ' + t.toFixed(1) : 'LAUNCH', fill:1 - clamp(t/(bayMax.get(b) || 1), 0, 1), state:t > 0 ? 'wait' : 'ok', hurt:hurt(b)});
  }
  if (hg.length) out.push({name:'Hangar', tiles:hg});
  return out;
}

export function drawStatus(p: Ship){
  if (!p.alive || innerWidth < 640) return;
  const S = sections(p); if (!S.length) return;
  const PADX = 10, cols = 3, gap = 4, W = Math.min(330, innerWidth*.3), tw = (W - PADX*2 - gap*(cols-1))/cols, th = 30;
  const rows = S.reduce((a, s) => a + Math.ceil(s.tiles.length/cols), 0);
  const H = 34 + S.length*18 + rows*(th + gap) + 6;
  const x0 = innerWidth - W - 16, y0 = innerHeight - H - 16;
  const X = hctx;
  X.save();
  // frame: black plate, orange rule, hazard stripes along the top, a cut corner
  X.globalAlpha = .9; X.fillStyle = INK;
  X.beginPath(); X.moveTo(x0, y0); X.lineTo(x0 + W - 14, y0); X.lineTo(x0 + W, y0 + 14); X.lineTo(x0 + W, y0 + H); X.lineTo(x0, y0 + H); X.closePath(); X.fill();
  X.globalAlpha = 1; X.strokeStyle = ORG; X.lineWidth = 2; X.stroke();
  X.save(); X.beginPath(); X.rect(x0 + 2, y0 + 2, W - 18, 6); X.clip();
  X.fillStyle = ORG; for (let s = -10; s < W; s += 12){ X.beginPath(); X.moveTo(x0 + s, y0 + 8); X.lineTo(x0 + s + 6, y0 + 8); X.lineTo(x0 + s + 12, y0 + 2); X.lineTo(x0 + s + 6, y0 + 2); X.closePath(); X.fill(); }
  X.restore();
  // title
  const warn = S.some(s => s.tiles.some(t => t.state==='out' || t.hurt));
  X.textBaseline = 'alphabetic'; X.textAlign = 'left';
  X.font = '400 20px Anton, Oswald, Impact, sans-serif'; X.fillStyle = ORG; X.fillText('SYSTEMS', x0 + PADX, y0 + 30);
  X.font = MONO(10); X.textAlign = 'right'; X.fillStyle = warn ? RED : MUTED;
  if (!warn || Math.floor(G.time*2) % 2) X.fillText(warn ? '▲ DAMAGE' : 'ALL NOMINAL', x0 + W - PADX, y0 + 29);
  let y = y0 + 38;
  for (const s of S){
    // section label with a rule running out to the edge
    X.textAlign = 'left'; X.font = COND(11); X.fillStyle = MUTED; X.fillText(s.name.toUpperCase(), x0 + PADX, y + 9);
    const lw = X.measureText(s.name.toUpperCase()).width;
    X.fillStyle = ORG; X.globalAlpha = .45; X.fillRect(x0 + PADX + lw + 6, y + 5, W - PADX*2 - lw - 6, 1); X.globalAlpha = 1;
    y += 16;
    s.tiles.forEach((t, n) => {
      const tx = x0 + PADX + (n % cols)*(tw + gap), ty = y + Math.floor(n/cols)*(th + gap);
      const col = t.state==='out' ? RED : t.state==='live' ? PAPER : ORG, flash = t.state==='live' && Math.floor(G.time*6) % 2;
      // tile body, a group-colour notch on the left, the label, the readout and a bar along the bottom
      X.fillStyle = t.state==='ok' ? 'rgba(255,138,0,.16)' : 'rgba(255,255,255,.04)'; X.fillRect(tx, ty, tw, th);
      X.strokeStyle = t.hurt ? RED : col; X.globalAlpha = t.state==='wait' ? .5 : 1; X.lineWidth = 1; X.strokeRect(tx + .5, ty + .5, tw - 1, th - 1); X.globalAlpha = 1;
      if (t.gc){ X.fillStyle = t.gc; X.fillRect(tx + 1, ty + 1, 3, th - 2); }
      X.font = COND(11); X.textAlign = 'left'; X.fillStyle = t.state==='wait' ? MUTED : t.state==='out' ? RED : PAPER;
      let lab = t.lab; while (lab.length > 3 && X.measureText(lab).width > tw - 10) lab = lab.slice(0, -1);
      X.fillText(lab, tx + 7, ty + 12);
      X.font = MONO(9); X.fillStyle = flash ? INK : col;
      if (flash){ X.fillStyle = PAPER; const w = X.measureText(t.sub).width + 4; X.fillRect(tx + 5, ty + 15, w, 10); X.fillStyle = INK; }
      X.fillText(t.sub, tx + 7, ty + 23);
      X.fillStyle = 'rgba(0,0,0,.8)'; X.fillRect(tx + 1, ty + th - 4, tw - 2, 3);
      X.fillStyle = t.state==='out' ? RED : t.state==='ok' ? ORG : t.state==='live' ? PAPER : MUTED; X.fillRect(tx + 1, ty + th - 4, (tw - 2)*clamp(t.fill, 0, 1), 3);
    });
    y += Math.ceil(s.tiles.length/cols)*(th + gap) + 2;
  }
  X.restore();
}
