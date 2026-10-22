import { audio, sfx } from './audio';
import { PAL, T } from './catalog';
import { cycleMirror, zoomBtn } from './controls';
import { buildAction, rotate } from './editor';
import { togglePause } from './fights';
import { clamp } from './grid';
import { camZoom, setAuto, setBrush, toggleGroup } from './groups';
import { mapNodeAt } from './mapdraw';
import { buildPick } from './render3d';
import { canJump, curNode, jumpTo, mapAction, toDrydock, toMap } from './starmap';
import { G } from './state';
import { select, syncMapPanel, syncUI, toast } from './ui';
import { keys } from './update';
import type { BlockType, Facing, Key } from './types';
import { $, PX, W, cv } from './view';

// Undo: one entry per press-drag-release in the drydock (design, facings and credits).
interface Snap { d: [Key, BlockType][]; o: [Key, Facing][]; c: number; inv: typeof G.inv; br: Key[] }
export const undoStack: Snap[] = [];
export const snap = (): Snap => ({d:[...G.design], o:[...G.dirs], c:G.credits, inv:{...G.inv}, br:[...G.broken]});
export const sameSnap = (a: Snap, b: Snap) => JSON.stringify([a.d,a.o]) === JSON.stringify([b.d,b.o]);
export function dropUndoMark(){ undoMark = null; }
export function commitUndoMark(){
  if (undoMark && !sameSnap(undoMark, snap())){ undoStack.push(undoMark); if (undoStack.length > 60) undoStack.shift(); }
  undoMark = null; syncUI();
}
export function undo(){
  const u = undoStack.pop(); if (!u){ toast('Nothing to undo'); return; }
  G.design = new Map(u.d); G.dirs = new Map(u.o); G.credits = u.c; G.inv = u.inv; G.broken = new Set(u.br); sfx('place'); syncUI();
}
export const ptrs = new Map<number, {x: number; y: number}>();
/** Drydock pointer state: an orbit drag (right or middle button, or two fingers), a pinch, and a tap waiting to see if it becomes a drag. */
export let orbitDrag: {x: number; y: number; moved: boolean} | null = null, pinch: {d: number; mx: number; my: number} | null = null,
  pending: boolean = false, undoMark: Snap | null = null;
/** Turn the drydock view by a drag of dx, dy canvas pixels. */
const orbitBy = (dx: number, dy: number) => { G.bYaw -= dx*.012; G.bPitch = clamp(G.bPitch + dy*.012, -1.45, 1.45); };
export const endPtr = (e: PointerEvent) => {
  ptrs.delete(e.pointerId);
  if (e.pointerType!=='touch') G.fireHeld = false;
  if (G.joy && G.joy.id===e.pointerId) G.joy = null;
  if (G.aimJoy && G.aimJoy.id===e.pointerId) G.aimJoy = null;
  if (G.mode==='build'){
    // a right click that didn't turn into an orbit removes the block under the cursor
    if (orbitDrag && !orbitDrag.moved && e.button===2){ undoMark = snap(); buildAction('sell', true); }
    if (pending && !pinch && G.drag) buildAction(G.drag, true);
    pending = false; orbitDrag = null;
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
      if (e.button===1 || e.button===2){ orbitDrag = {x, y, moved:false}; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} return; }
      if (touch && ptrs.size===2){
        // second finger: drop the pending tap and orbit/pinch instead
        pending = false; G.drag = null; dropUndoMark();
        const [p1,p2] = [...ptrs.values()]; pinch = {d:Math.hypot(p2.x-p1.x, p2.y-p1.y), mx:(p1.x+p2.x)/2, my:(p1.y+p2.y)/2};
        return;
      }
      if (ptrs.size > 1) return;
      G.hover = buildPick(x, y);
      G.drag = G.sel==='sell' ? 'sell' : 'place';
      G.lastCell = G.hover ? `${G.hover.i},${G.hover.j},${G.hover.l}` : null; undoMark = snap();
      if (touch) pending = true; else buildAction(G.drag, true);
    }
    try { cv.setPointerCapture(e.pointerId); } catch {}
  });
  cv.addEventListener('pointermove', e => {
    const x = e.clientX/PX, y = e.clientY/PX, touch = e.pointerType==='touch';
    const prev = ptrs.get(e.pointerId);
    if (prev) ptrs.set(e.pointerId, {x, y});
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
    if (orbitDrag){
      if (Math.hypot(x-orbitDrag.x, y-orbitDrag.y) > 2) orbitDrag.moved = true;
      if (orbitDrag.moved){ orbitBy(x-orbitDrag.x, y-orbitDrag.y); orbitDrag.x = x; orbitDrag.y = y; }
      return;
    }
    if (pinch && ptrs.size >= 2){
      // two fingers: drag to orbit, spread to zoom
      const [p1,p2] = [...ptrs.values()], d = Math.hypot(p2.x-p1.x, p2.y-p1.y), mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
      orbitBy(mx - pinch.mx, my - pinch.my);
      if (pinch.d > 4 && d > 4) zoomBtn(d/pinch.d);
      pinch = {d, mx, my}; return;
    }
    G.hover = touch && !G.drag ? null : buildPick(x, y);
    const id = G.hover ? `${G.hover.i},${G.hover.j},${G.hover.l}` : null;
    if (G.drag && id && id !== G.lastCell){
      if (pending){ pending = false; }
      // painting: each new cell under a held button gets the same action
      G.lastCell = id; buildAction(G.drag);
    }
  });
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', e => {
    if (G.mode==='combat'){ e.preventDefault(); camZoom(Math.exp(e.deltaY*.0012)); return; }
    if (G.mode!=='build') return;
    e.preventDefault(); zoomBtn(Math.exp(-e.deltaY*.0015));
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
      const key = e.key.toLowerCase(), t = PAL.find(p => T[p].key === key); if (t) select(t);
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
