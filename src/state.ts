import { HEAD_OF } from './catalog';
import { K, KI, KJ } from './grid';
import type { GameState } from './types';

// ---------- state ----------
export const G: GameState = {
  mode:'title', bz:1, bpx:0, bpy:0, mir:1, sel:'hull', rot:0, mirror:true, hover:null, drag:null, lastCell:null, grpBrush:0,
  cockpit:'std', paint:'steel', stage:1, credits:0, design:new Map(), dirs:new Map(), lv:{}, inv:{}, dmg:{}, grp:{}, auto:[false,false,false,true,false],
  broken:new Set(), lost:new Set(), fresh:new Set(),
  map:null, node:null, pendingNode:null, shopNode:null, mapHover:null, stats:null, meta:{data:0, lv:{}}, bounty:0, outfit:false, pick:null,
  fight:'fight', ships:[], player:null, boss:null, pb:[], eb:[], fx:[], beams:[], slugs:[],
  waves:[], waveIdx:0, waveGap:0, time:0, S:1, SC:1, AW:0, AH:0, camX:0, camY:0, camOX:0, camOY:0, zoom:1, camMul:1,
  span:0, spanT:0, span0:0, spanAt:0, spanStage:null, fit:0, swarmT:0,
  paused:false, aimAuto:false, shiftAbs:false, calm:false, impT:0, abT:0, abReq:false, fireT:0, salvoT:0, cloakT:0, fireHeld:false, mouse:{x:0,y:0,has:false}, joy:null, aimJoy:null,
  banner:null, deadT:0, earned:0, shake:0, aim:{x:0,y:0},
};
// Build area: no fixed limit, it always reaches two cells past the furthest block. Frozen while dragging so cells don't slide under the pointer.
export const buildR = () => {
  if (G.drag && G.dragR) return G.dragR;
  let m = 0; for (const k of G.design.keys()) m = Math.max(m, Math.abs(KI(k)), Math.abs(KJ(k)));
  return Math.max(3, m + 2);
};
export const scaleOf = (s: number) => Math.pow(1.22, s-1);
// A multi-cell part counts as one block.
export const blockCount = () => { let n = 0; for (const t of G.design.values()) if (!HEAD_OF[t]) n++; return n; };
// World units across the short side of the screen: the camera backs off as the player's hull grows.
export const spanFor = (r: number, S: number) => Math.max(360 + 9.5*r, 360*Math.pow(S,.6));
export const speedOf = (thrust: number, mass: number) => 60 + 260*Math.min(1.3, Math.sqrt(thrust/Math.max(1,mass)));
export const turnOf = (torque: number, inertia: number, mass: number) => Math.min(3.5, 2.2*Math.sqrt(torque/Math.max(1,inertia))/Math.sqrt(1 + mass/60));

// wiring that runs once at start-up
export function init(){
  ([[0,0,'core'],[0,-1,'cannon'],[-1,0,'hull'],[1,0,'hull'],[0,1,'engine']] as const).forEach(([i,j,t]) => G.design.set(K(i,j),t));
  G.dirs.set(K(0,-1),0); G.dirs.set(K(0,1),0);
}
