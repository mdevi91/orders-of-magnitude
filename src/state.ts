import { Vector3 } from 'three';
import { HEAD_OF } from './catalog';
import { K, KI, KJ, KL } from './grid';
import { metaLv } from './runs';
import type { GameState } from './types';

// ---------- state ----------
export const G: GameState = {
  mode:'title', bYaw:.7, bPitch:.5, bDist:0, mir:1, sel:'hull', rot:0, mirror:true, hover:null, drag:null, lastCell:null, grpBrush:0,
  stage:1, credits:0, design:new Map(), dirs:new Map(), lv:{}, inv:{}, dmg:{}, grp:{}, auto:[false,false,false,true,false],
  broken:new Set(), lost:new Set(), fresh:new Set(),
  map:null, node:null, pendingNode:null, shopNode:null, mapHover:null, stats:null, meta:{data:0, lv:{}}, bounty:0, pick:null,
  fight:'fight', ships:[], player:null, boss:null, pb:[], eb:[], fx:[], beams:[],
  waves:[], waveIdx:0, waveGap:0, time:0, S:1, SC:1, AW:0, AH:0, AD:0, camMul:1, swarmT:0,
  paused:false, aimAuto:false, fireHeld:false, mouse:{x:0,y:0,has:false}, joy:null, aimJoy:null, aimAt:null, moveWish:null,
  banner:null, deadT:0, earned:0, shake:0, aim:new Vector3(),
};
// How far the design reaches from the core in any direction, plus room to grow by two cells.
export const buildR = () => {
  let m = 0; for (const k of G.design.keys()) m = Math.max(m, Math.abs(KI(k)), Math.abs(KJ(k)), Math.abs(KL(k)));
  return Math.max(3, m + 2);
};
export const scaleOf = (s: number) => Math.pow(1.22, s-1);
// Block limit: grows every sector and with the hangar's frame upgrade. A multi-cell part counts as one block.
export const blockLimit = () => 30 + 15*G.stage + 15*metaLv('frame');
export const blockCount = () => { let n = 0; for (const t of G.design.values()) if (!HEAD_OF[t]) n++; return n; };
export const speedOf = (thrust: number, mass: number) => 60 + 260*Math.min(1.3, Math.sqrt(thrust/Math.max(1,mass)));
export const turnOf = (torque: number, inertia: number, mass: number) => Math.min(3.5, 2.2*Math.sqrt(torque/Math.max(1,inertia))/Math.sqrt(1 + mass/60));

// wiring that runs once at start-up
export function init(){
  ([[0,0,'core'],[0,-1,'cannon'],[-1,0,'hull'],[1,0,'hull'],[0,1,'engine']] as const).forEach(([i,j,t]) => G.design.set(K(i,j),t));
  G.dirs.set(K(0,-1),0); G.dirs.set(K(0,1),0);
}
