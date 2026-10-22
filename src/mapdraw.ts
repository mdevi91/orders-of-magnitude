// @ts-nocheck
import { drawSpace } from './draw';
import { TAU, clamp } from './grid';
import { NODE, canJump, curNode, exitNode } from './starmap';
import { G } from './state';
import { $, FONT, H, PX, W, ctx } from './view';

// ---------- star map drawing ----------
export function layoutMap(){
  const pr = $('mapPanel').getBoundingClientRect(), top = ($('hud').getBoundingClientRect().bottom + 8)/PX;
  let x0 = 8, y0 = top + 18, x1 = W - 8, y1 = H - 12;
  if (pr.width && pr.left/PX > W*.45) x1 = (pr.left - 8)/PX; else if (pr.height) y1 = (pr.top - 12)/PX;
  return {x0, y0, x1, y1};
}
export const nodeXY = (n, L) => [Math.round(L.x0 + 14 + n.x*(L.x1 - L.x0 - 28)), Math.round(L.y0 + 4 + n.y*(L.y1 - L.y0 - 8))];
export function mapNodeAt(x, y){
  const L = layoutMap(); let best = null, bd = 13*13;
  for (const n of G.map.nodes){ const [X,Y] = nodeXY(n,L), d = (X-x)**2 + (Y-y)**2; if (d < bd){ bd = d; best = n; } }
  return best;
}
export function renderMap(){
  drawSpace(G.time*14, 0, 1);
  const L = layoutMap(), M = G.map, cur = curNode(), seen = new Set(M.seen);
  // lanes: gold where you have flown, pulsing cyan where you can jump next
  ctx.lineWidth = 1;
  for (const n of M.nodes) for (const id of n.links){
    const m = M.nodes[id], [x1,y1] = nodeXY(n,L), [x2,y2] = nodeXY(m,L);
    const open = n===cur && canJump(m), at = M.seen.indexOf(m.id), flown = at > 0 && M.seen[at-1] === n.id;
    ctx.strokeStyle = flown ? '#ffc46b' : open ? '#5fd8ff' : '#2a3450';
    ctx.globalAlpha = open ? .6 + .4*Math.sin(G.time*5) : 1;
    if (open){ ctx.setLineDash([3,2]); ctx.lineDashOffset = -G.time*10; }
    ctx.beginPath(); ctx.moveTo(x1+.5,y1+.5); ctx.lineTo(x2+.5,y2+.5); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  ctx.globalAlpha = 1;
  ctx.font = FONT(8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of M.nodes){
    const [X,Y] = nodeXY(n,L), N = NODE[n.type], big = exitNode(n), r = big ? 9 : 6, open = canJump(n);
    ctx.globalAlpha = seen.has(n.id) && n!==cur ? .4 : 1;
    ctx.fillStyle = '#05060c'; ctx.beginPath(); ctx.arc(X,Y,r,0,TAU); ctx.fill();
    ctx.strokeStyle = N.col; ctx.lineWidth = G.mapHover===n ? 2 : 1; ctx.beginPath(); ctx.arc(X,Y,r,0,TAU); ctx.stroke();
    if (n.type==='elite' || big){ ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X,Y,r-2,0,TAU); ctx.stroke(); }
    ctx.fillStyle = N.col; ctx.fillText(N.g, X+1, Y+1);
    if (open){ ctx.globalAlpha = .5 + .5*Math.sin(G.time*5); ctx.strokeStyle = '#e8ecf2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X,Y,r+3,0,TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // you are here: a bobbing marker over the current beacon
  const [cx,cy] = nodeXY(cur,L), bob = Math.round(Math.sin(G.time*3)*1.5), top = cy - (exitNode(cur) ? 13 : 10) + bob;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx+.5, top); ctx.lineTo(cx-3.5, top-5); ctx.lineTo(cx+4.5, top-5); ctx.closePath(); ctx.fill();
  const h = G.mapHover;
  if (h){
    const [X,Y] = nodeXY(h,L), N = NODE[h.type], t = N.name.toUpperCase(), w = Math.ceil(ctx.measureText(t).width) + 8;
    const ty = Y - L.y0 > 28 ? Y - 22 : Y + 22, tx = Math.round(clamp(X, L.x0 + w/2, L.x1 - w/2) - w/2);
    ctx.fillStyle = '#05060c'; ctx.fillRect(tx, ty-7, w, 14); ctx.strokeStyle = N.col; ctx.lineWidth = 1; ctx.strokeRect(tx+.5, ty-6.5, w-1, 13);
    ctx.fillStyle = N.col; ctx.fillText(t, tx + w/2 + 1, ty+1);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8497c4'; ctx.textAlign = 'left'; ctx.fillText(`SECTOR ${G.stage}`, Math.round(L.x0 + 4), Math.round(L.y0 - 8));
}
