// @ts-nocheck
import { audio, sfx } from './audio';
import { PAL, T } from './catalog';
import { cycleMirror, zoomBtn } from './controls';
import { layoutBuild } from './draw';
import { buildAction, cellAt, rotate } from './editor';
import { togglePause } from './fights';
import { clamp } from './grid';
import { camZoom, setAuto, setBrush, toggleGroup } from './groups';
import { mapNodeAt } from './mapdraw';
import { canJump, curNode, jumpTo, mapAction, toDrydock, toMap } from './starmap';
import { G, buildR } from './state';
import { select, syncMapPanel, syncUI, toast } from './ui';
import { keys } from './update';
import { $, PX, W, cv } from './view';

// Drydock zoom about a canvas point: the cell under (x,y) stays put.
export function zoomAt(x, y, f){
  const L = layoutBuild(), u = (x-L.cx)/L.cs, v = (y-L.cy)/L.cs;
  G.bz = clamp(G.bz*f, .3, 8);
  const M = layoutBuild(); G.bpx += x - (M.cx + u*M.cs); G.bpy += y - (M.cy + v*M.cs);
}
// Undo: one entry per press-drag-release in the drydock (design, facings and credits).
export const undoStack = [];
export const snap = () => ({d:[...G.design], o:[...G.dirs], c:G.credits, inv:{...G.inv}, br:[...G.broken]});
export const sameSnap = (a,b) => JSON.stringify([a.d,a.o]) === JSON.stringify([b.d,b.o]);
export function dropUndoMark(){ undoMark = null; }
export function commitUndoMark(){
  if (undoMark && !sameSnap(undoMark, snap())){ undoStack.push(undoMark); if (undoStack.length > 60) undoStack.shift(); }
  undoMark = null; syncUI();
}
export function undo(){
  const u = undoStack.pop(); if (!u){ toast('Nothing to undo'); return; }
  G.design = new Map(u.d); G.dirs = new Map(u.o); G.credits = u.c; G.inv = u.inv; G.broken = new Set(u.br); sfx('place'); syncUI();
}
export const ptrs = new Map();
export let pinch = null, panning = null, pending = null, undoMark = null;
export const endPtr = e => {
  ptrs.delete(e.pointerId);
  if (e.pointerType!=='touch') G.fireHeld = false;
  if (G.joy && G.joy.id===e.pointerId) G.joy = null;
  if (G.aimJoy && G.aimJoy.id===e.pointerId) G.aimJoy = null;
  if (G.mode==='build'){
    if (pending && !pinch) buildAction(pending.i, pending.j, G.drag, true);
    pending = null; panning = null;
    if (pinch && ptrs.size < 2) pinch = null;
    if (G.drag || undoMark) commitUndoMark();
  }
  G.drag = null;
  if (e.pointerType==='touch') G.hover = null;
};

// wiring that runs once at start-up
export function init(){
  // ---------- input (pointer coordinates converted to canvas pixels) ----------
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const x = e.clientX/PX, y = e.clientY/PX, touch = e.pointerType==='touch';
    ptrs.set(e.pointerId, {x, y}); audio();
    if (!touch) G.mouse = {x, y, has:true};
    if (G.mode==='combat' && !touch && e.button===0) G.fireHeld = true;
    if (G.mode==='map' && $('overlay').hidden){
      // touch picks a beacon first and jumps on a second tap; a mouse click jumps straight away
      const n = mapNodeAt(x,y);
      if (n && (!touch || G.mapHover===n)){ if (n===curNode()) mapAction(); else jumpTo(n); }
      else { G.mapHover = n; syncMapPanel(); }
      return;
    }
    if (G.mode==='combat' && touch){
      // twin-stick: left half moves, right half aims; with no aim stick the ship auto-aims
      if (x < W/2 && !G.joy) G.joy = {id:e.pointerId, x0:x, y0:y, x, y};
      else if (!G.aimJoy) G.aimJoy = {id:e.pointerId, x0:x, y0:y, x, y};
      setAuto(true, false);
    }
    if (G.mode==='build'){
      if (e.button===1){ panning = {x, y, bpx:G.bpx, bpy:G.bpy}; e.preventDefault(); return; }
      if (touch && ptrs.size===2){
        // second finger: drop the pending tap and pinch/pan instead
        pending = null; G.drag = null; dropUndoMark();
        const [p1,p2] = [...ptrs.values()]; pinch = {d:Math.hypot(p2.x-p1.x, p2.y-p1.y), mx:(p1.x+p2.x)/2, my:(p1.y+p2.y)/2};
        return;
      }
      if (ptrs.size > 1) return;
      const c = cellAt(x,y);
      G.dragR = buildR(); G.drag = (e.button===2 || G.sel==='sell') ? 'sell' : 'place';
      G.lastCell = c.i+','+c.j; G.hover = c; undoMark = snap();
      if (touch) pending = c; else buildAction(c.i,c.j,G.drag,true);
    }
    try { cv.setPointerCapture(e.pointerId); } catch {}
  });
  cv.addEventListener('pointermove', e => {
    const x = e.clientX/PX, y = e.clientY/PX, touch = e.pointerType==='touch';
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {x, y});
    if (!touch) G.mouse = {x, y, has:true};
    if (G.mode==='combat'){
      if (G.joy && G.joy.id===e.pointerId){ G.joy.x = x; G.joy.y = y; }
      if (G.aimJoy && G.aimJoy.id===e.pointerId){ G.aimJoy.x = x; G.aimJoy.y = y; }
      return;
    }
    if (G.mode==='map' && !touch){
      const n = mapNodeAt(x,y);
      if (n !== G.mapHover){ G.mapHover = n; syncMapPanel(); }
      cv.style.cursor = n && (canJump(n) || n===curNode()) ? 'pointer' : '';
      return;
    }
    if (G.mode!=='build') return;
    if (panning){ G.bpx = panning.bpx + x - panning.x; G.bpy = panning.bpy + y - panning.y; return; }
    if (pinch && ptrs.size >= 2){
      const [p1,p2] = [...ptrs.values()], d = Math.hypot(p2.x-p1.x, p2.y-p1.y), mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
      G.bpx += mx - pinch.mx; G.bpy += my - pinch.my;
      if (pinch.d > 4 && d > 4) zoomAt(mx, my, d/pinch.d);
      pinch = {d, mx, my}; return;
    }
    const c = cellAt(x,y); G.hover = touch && !G.drag ? null : c;
    const id = c.i+','+c.j;
    if (G.drag && id !== G.lastCell){
      if (pending){ buildAction(pending.i, pending.j, G.drag, false); pending = null; }
      G.lastCell = id; buildAction(c.i,c.j,G.drag);
    }
  });
  cv.addEventListener('pointerup', endPtr);   cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', e => {
    if (G.mode==='combat'){ e.preventDefault(); camZoom(Math.exp(e.deltaY*.0012)); return; }
    if (G.mode!=='build') return;
    e.preventDefault(); zoomAt(e.clientX/PX, e.clientY/PX, Math.exp(-e.deltaY*.0015));
  }, {passive:false});
  cv.addEventListener('pointerleave', e => { if (e.pointerType==='mouse' && !G.drag) G.hover = null; });
  addEventListener('keydown', e => {
    audio();
    if (e.target instanceof HTMLInputElement && e.code==='Space') return;
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (G.mode==='build' && G.grpBrush){
      const gd = /^Digit([1-5])$/.exec(e.code); if (gd) setBrush(+gd[1]);
      if (e.code==='Escape' || e.code==='Enter') setBrush(0);
    } else if (G.mode==='build'){
      const key = e.key.toLowerCase(), t = PAL.find(t => T[t].key === key); if (t) select(t);
      if (e.code==='KeyR') rotate();
      if (e.code==='Equal' || e.code==='NumpadAdd') zoomBtn(1.25);
      if (e.code==='Minus' || e.code==='NumpadSubtract') zoomBtn(.8);
      if (e.code==='KeyZ' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); undo(); }
      if (e.code==='KeyM') cycleMirror();
      if (e.code==='Enter' && !(e.target instanceof HTMLButtonElement)) toMap();
    } else if (G.mode==='map' && $('overlay').hidden){
      if (e.code==='KeyD') toDrydock();
    } else if (G.mode==='combat'){
      if (e.code==='KeyP' || e.code==='Escape') togglePause();
      if (e.code==='KeyT') setAuto(!G.aimAuto);
      if (e.code==='Equal' || e.code==='NumpadAdd') camZoom(.85);
      if (e.code==='Minus' || e.code==='NumpadSubtract') camZoom(1.18);
      const gd = /^Digit([1-5])$/.exec(e.code); if (gd) toggleGroup(+gd[1]);
    }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; G.fireHeld = false; if (G.mode==='combat' && !G.paused) togglePause(); });
}
