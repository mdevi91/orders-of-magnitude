// @ts-nocheck
import { HEAD_OF } from './catalog';
import { K, KI, KJ } from './grid';
import { metaLv } from './runs';

// ---------- state ----------
export const G = {
  mode:'title', bz:1, bpx:0, bpy:0, mir:1, stage:1, credits:0, design:new Map(), dirs:new Map(), lv:{}, sel:'hull', rot:0, mirror:true,
  inv:{}, dmg:{}, grp:{}, auto:[false,false,false,true,false], camMul:1, broken:new Set(), lost:new Set(), map:null, node:null, stats:null, fresh:new Set(), mapHover:null, meta:{data:0, lv:{}},
  ships:[], player:null, pb:[], eb:[], fx:[], beams:[],
  waves:[], waveIdx:0, waveGap:0, time:0, S:1, SC:1, AW:0, AH:0, camX:0, camY:0, zoom:1, span:0, spanT:0, span0:0, spanAt:0, swarmT:0,
  paused:false, aimAuto:false, fireHeld:false, mouse:{x:0,y:0,has:false}, tdx:0, tdy:0, touchId:null,
  banner:null, deadT:0, earned:0, shake:0, hover:null, drag:null, lastCell:null, aim:{x:0,y:0},
};
// Build area: no fixed limit, it always reaches two cells past the furthest block. Frozen while dragging so cells don't slide under the pointer.
export const buildR = () => {
  if (G.drag && G.dragR) return G.dragR;
  let m = 0; for (const k of G.design.keys()) m = Math.max(m, Math.abs(KI(k)), Math.abs(KJ(k)));
  return Math.max(3, m + 2);
};
export const scaleOf = s => Math.pow(1.22, s-1);
// Block limit: grows every sector and with the hangar's frame upgrade. A multi-cell part counts as one block.
export const blockLimit = () => 30 + 15*G.stage + 15*metaLv('frame');
export const blockCount = () => { let n = 0; for (const t of G.design.values()) if (!HEAD_OF[t]) n++; return n; };
// World units across the short side of the screen: the camera backs off as the player's hull grows.
export const spanFor = (r,S) => Math.max(360 + 9.5*r, 360*Math.pow(S,.6));
export const speedOf = (thrust,mass) => 60 + 260*Math.min(1.3, Math.sqrt(thrust/Math.max(1,mass)));
export const turnOf = (torque,inertia,mass) => Math.min(3.5, 2.2*Math.sqrt(torque/Math.max(1,inertia))/Math.sqrt(1 + mass/60));

// wiring that runs once at start-up
export function init(){
  [[0,0,'core'],[0,-1,'cannon'],[-1,0,'hull'],[1,0,'hull'],[0,1,'engine']].forEach(([i,j,t]) => G.design.set(K(i,j),t));
  G.dirs.set(K(0,-1),0);   G.dirs.set(K(0,1),0);
}
