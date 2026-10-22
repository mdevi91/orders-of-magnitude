// The 3D view: one WebGL scene for fights, the title and the star map backdrop, and one for the drydock.
// It renders at the game's low pixel resolution and CSS scales it up, so the voxels keep a pixel-art edge.
import {
  AdditiveBlending, AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, DynamicDrawUsage,
  EdgesGeometry, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, MeshBasicMaterial,
  MeshLambertMaterial, Object3D, PerspectiveCamera, Points, PointsMaterial, Quaternion, Ray, Raycaster, Scene, Sprite, SpriteMaterial,
  Vector2, Vector3, WebGLRenderer,
} from 'three';
import { BCOL, COL, ESH, PARTS, T, def, grpOf, isWeapon, shRad } from './catalog';
import { cellsFor, placeCheck, placeSpots } from './editor';
import { BS, DIRV, FACE, KI, KJ, KL, OPP, clamp, rand } from './grid';
import { G } from './state';
import type { Block, BuildHover, Cell, Facing, Key, Ship, Team } from './types';
import { $, H, W } from './view';

// ---------- renderer and scenes ----------
export let renderer: WebGLRenderer | null = null;
export const camera = new PerspectiveCamera(60, 16/9, 2, 60000);
const scene = new Scene(), buildScene = new Scene();
const UP = new Vector3(0,1,0);
const m4 = new Matrix4(), tq = new Quaternion(), tv = new Vector3(), tv2 = new Vector3(), tcol = new Color(), one = new Vector3(1,1,1);

/** Block colours: plating in steel for the player and rust for enemies; systems in their own colours. */
const PLATING: Record<Team, {hull: string; armor: string}> = {p:{hull:'#8f9aac', armor:'#5f6a7c'}, e:{hull:'#9a4630', armor:'#6a3024'}, a:{hull:'#8f9aac', armor:'#5f6a7c'}};
export function blockColor(t: Cell, team: Team, out = tcol){
  if (t==='hull' || t==='armor') return out.set(PLATING[team][t]);
  if (t==='core') return out.set(team==='e' ? '#ff6a3a' : '#5fd8ff');
  return out.set(COL[team][t] || COL.p[t] || '#b0b8c8');
}
/** Turrets and fixed weapons get a barrel; engines get a nozzle. */
const BARREL: Partial<Record<Cell, number>> = {cannon:.9, gatling:1, scatter:.7, flak:.8, ion:.9, torpedo:1.1, rail:1.4, laser:1.1, core:.6};

function lights(s: Scene){
  s.add(new AmbientLight(0x404a60, 1.4));
  s.add(new HemisphereLight(0x9ab8ff, 0x302018, .8));
  const sun = new DirectionalLight(0xfff2dd, 2.2); sun.position.set(1, 2, 1.4); s.add(sun);
}

// starfield and nebulae, recentred on the camera every frame so they never get closer
const sky = new Group();
function makeSky(){
  const n = 1800, pos = new Float32Array(n*3), col = new Float32Array(n*3);
  for (let q=0; q<n; q++){
    const z = rand(-1,1), a = rand(0, Math.PI*2), r = Math.sqrt(1-z*z), d = 20000;
    pos.set([r*Math.cos(a)*d, z*d, r*Math.sin(a)*d], q*3);
    const b = rand(.35, 1); col.set([b*rand(.8,1), b*rand(.85,1), b], q*3);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('color', new BufferAttribute(col, 3));
  sky.add(new Points(g, new PointsMaterial({size:1.5, sizeAttenuation:false, vertexColors:true, depthWrite:false})));
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128;
  const x = cvs.getContext('2d')!, gr = x.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,.55)'); gr.addColorStop(.5,'rgba(255,255,255,.18)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0,0,128,128);
  const tex = new CanvasTexture(cvs);
  for (const [dx,dy,dz,c] of [[1,.3,-1,'#5a2a9a'],[-1,-.2,-.4,'#1a4a9a'],[.2,-.5,1,'#8a2a5a'],[-.4,.6,.8,'#2a7a7a']] as const){
    const sp = new Sprite(new SpriteMaterial({map:tex, color:c, transparent:true, depthWrite:false, blending:AdditiveBlending}));
    sp.position.set(dx,dy,dz).normalize().multiplyScalar(18000); sp.scale.setScalar(16000); sky.add(sp);
  }
}

// ---------- ships ----------
const BOX = new BoxGeometry(BS*.94, BS*.94, BS*.94);
const BARREL_GEO = new BoxGeometry(BS*.24, BS*.24, BS).translate(0, 0, -BS*.5);
const FLAME_GEO = new BoxGeometry(BS*.5, BS*.5, BS*.9).translate(0, 0, BS*.45);
const hullMat = new MeshLambertMaterial({flatShading:true});
const barrelMat = new MeshLambertMaterial({color:0xc8d0dc});
const flameMat = new MeshBasicMaterial({color:0xffa040, blending:AdditiveBlending, transparent:true, depthWrite:false});
interface ShipMesh { g: Group; boxes: InstancedMesh; barrels: InstancedMesh; flames: InstancedMesh; ver: number; blocks: Block[]; guns: Block[]; engines: Block[]; flash: Set<Block> }
const meshes = new Map<Ship, ShipMesh>();
const dummy = new Object3D();
/** The rotation that points local -z along a direction. */
const aimQ = (dir: Vector3, out = tq) => out.setFromUnitVectors(tv2.set(0,0,-1), dir);

function buildShipMesh(s: Ship): ShipMesh {
  const blocks = [...s.blocks.values()], guns = blocks.filter(b => BARREL[b.t]), engines = blocks.filter(b => b.t==='engine');
  const boxes = new InstancedMesh(BOX, hullMat, Math.max(1, blocks.length));
  const barrels = new InstancedMesh(BARREL_GEO, barrelMat, Math.max(1, guns.length));
  const flames = new InstancedMesh(FLAME_GEO, flameMat, Math.max(1, engines.length));
  blocks.forEach((b, n) => {
    dummy.position.set(b.i*BS, b.l*BS, b.j*BS); dummy.quaternion.identity(); dummy.scale.copy(one); dummy.updateMatrix();
    boxes.setMatrixAt(n, dummy.matrix); boxes.setColorAt(n, shade(b, s.team));
  });
  boxes.count = blocks.length; barrels.count = guns.length; flames.count = engines.length;
  barrels.instanceMatrix.setUsage(DynamicDrawUsage); flames.instanceMatrix.setUsage(DynamicDrawUsage);
  const g = new Group(); g.add(boxes, barrels, flames); scene.add(g);
  return {g, boxes, barrels, flames, ver:s.ver, blocks, guns, engines, flash:new Set()};
}
/** A block's colour with battle damage darkening it. */
function shade(b: Block, team: Team){
  blockColor(b.t, team); const k = b.hp/b.max;
  return k < .7 ? tcol.multiplyScalar(.45 + .55*k/.7) : tcol;
}
function disposeMesh(m: ShipMesh){ scene.remove(m.g); m.boxes.dispose(); m.barrels.dispose(); m.flames.dispose(); }
function syncShips(){
  const live = new Set(G.ships.filter(s => s.alive));
  for (const [s,m] of meshes) if (!live.has(s)){ disposeMesh(m); meshes.delete(s); }
  const p = G.player;
  for (const s of live){
    let m = meshes.get(s);
    if (!m || m.ver !== s.ver){ if (m) disposeMesh(m); m = buildShipMesh(s); meshes.set(s, m); }
    m.g.position.copy(s.p); m.g.quaternion.copy(s.q);
    // white flash on hit, then back to the damaged colour
    m.blocks.forEach((b, n) => {
      const hot = G.time - b.hit < .06;
      if (hot){ m!.boxes.setColorAt(n, tcol.set('#ffffff')); m!.flash.add(b); }
      else if (m!.flash.has(b)){ m!.boxes.setColorAt(n, shade(b, s.team)); m!.flash.delete(b); }
    });
    if (m.boxes.instanceColor) m.boxes.instanceColor.needsUpdate = true;
    // barrels: the player's turrets follow their aim, enemy guns track the player, fixed weapons point along their facing
    const inv = tq.copy(s.q).invert().clone();
    m.guns.forEach((b, n) => {
      const d = def(b.t), arc = d?.gun?.arc ?? 0;
      let dir: Vector3 = DIRV[b.o];
      if (s.team==='p' && b.aim && arc) dir = tv.copy(b.aim).applyQuaternion(inv);
      else if (s.team==='e' && p) dir = tv.copy(p.p).sub(s.p).normalize().applyQuaternion(inv);
      const len = BARREL[b.t] || 1, P = PARTS[b.t];
      dummy.position.set(b.i*BS, b.l*BS, b.j*BS); aimQ(dir, dummy.quaternion); dummy.scale.set(P ? 1.6 : 1, P ? 1.6 : 1, len); dummy.updateMatrix();
      m!.barrels.setMatrixAt(n, dummy.matrix);
    });
    m.barrels.instanceMatrix.needsUpdate = true;
    // engine flames behind lit engines
    m.engines.forEach((b, n) => {
      const [fi,fj,fl] = FACE[OPP[b.o]], lit = b.firing ? rand(.7,1.3) : .001;
      dummy.position.set((b.i + fi*.5)*BS, (b.l + fl*.5)*BS, (b.j + fj*.5)*BS); aimQ(DIRV[b.o], dummy.quaternion); dummy.scale.set(lit, lit, lit); dummy.updateMatrix();
      m!.flames.setMatrixAt(n, dummy.matrix);
    });
    m.flames.instanceMatrix.needsUpdate = true;
  }
}

// ---------- bullets, beams, effects, shields ----------
const MAXB = 2000;
const bolts = new InstancedMesh(new BoxGeometry(1,1,1), new MeshBasicMaterial({blending:AdditiveBlending, transparent:true, depthWrite:false}), MAXB);
const ORB = new IcosahedronGeometry(1, 1);
const booms = new InstancedMesh(ORB, new MeshBasicMaterial({blending:AdditiveBlending, transparent:true, depthWrite:false}), 400);
const smokes = new InstancedMesh(ORB, new MeshBasicMaterial({color:0x4a5470, transparent:true, opacity:.35, depthWrite:false}), 600);
const debs = new InstancedMesh(new BoxGeometry(BS*.5, BS*.5, BS*.5), new MeshLambertMaterial({}), 1200);
const bubbles = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshBasicMaterial({blending:AdditiveBlending, transparent:true, opacity:.22, depthWrite:false, wireframe:true}), 64);
const MAXS = 2000, sparkPos = new Float32Array(MAXS*3), sparkCol = new Float32Array(MAXS*3), sparkGeo = new BufferGeometry();
sparkGeo.setAttribute('position', new BufferAttribute(sparkPos, 3).setUsage(DynamicDrawUsage)); sparkGeo.setAttribute('color', new BufferAttribute(sparkCol, 3).setUsage(DynamicDrawUsage));
const sparkPts = new Points(sparkGeo, new PointsMaterial({size:2, sizeAttenuation:false, vertexColors:true, blending:AdditiveBlending, transparent:true, depthWrite:false}));
const MAXL = 1200, linePos = new Float32Array(MAXL*6), lineCol = new Float32Array(MAXL*6), lineGeo = new BufferGeometry();
lineGeo.setAttribute('position', new BufferAttribute(linePos, 3).setUsage(DynamicDrawUsage)); lineGeo.setAttribute('color', new BufferAttribute(lineCol, 3).setUsage(DynamicDrawUsage));
const lines = new LineSegments(lineGeo, new LineBasicMaterial({vertexColors:true, blending:AdditiveBlending, transparent:true, depthWrite:false}));
const arena = new LineSegments(new EdgesGeometry(new BoxGeometry(2,2,2)), new LineBasicMaterial({color:0xff6e3c, transparent:true, opacity:.25}));
for (const o of [bolts, booms, debs, bubbles]) o.instanceMatrix.setUsage(DynamicDrawUsage);
for (const o of [bolts, booms, smokes, debs, bubbles, sparkPts, lines]) o.frustumCulled = false;

let nl = 0;
function line(a: Vector3, b: Vector3, col: string, k = 1){
  if (nl >= MAXL) return;
  linePos.set([a.x,a.y,a.z,b.x,b.y,b.z], nl*6); tcol.set(col).multiplyScalar(k); lineCol.set([tcol.r,tcol.g,tcol.b,tcol.r,tcol.g,tcol.b], nl*6); nl++;
}
function syncProjectiles(){
  let n = 0;
  for (const arr of [G.pb, G.eb]) for (const b of arr){
    if (n >= MAXB) break;
    const sp = b.v.length(), len = b.r*1.6 + Math.min(sp*.02, 14);
    dummy.position.copy(b.p); if (sp > 1) aimQ(tv.copy(b.v).divideScalar(sp), dummy.quaternion); else dummy.quaternion.identity();
    dummy.scale.set(b.r*1.6, b.r*1.6, len); dummy.updateMatrix(); bolts.setMatrixAt(n, dummy.matrix);
    bolts.setColorAt(n, tcol.set(BCOL[b.kind] || '#ffffff')); n++;
  }
  bolts.count = n; bolts.instanceMatrix.needsUpdate = true; if (bolts.instanceColor) bolts.instanceColor.needsUpdate = true;
  // beams: rails, tesla arcs and point defense zaps, then lasers and enemy rail sights
  nl = 0;
  for (const b of G.beams){
    const a = b.life/b.max;
    if (b.kind==='tesla'){
      // lightning: a jagged line that re-rolls every frame
      let last = b.a;
      for (let q=1; q<=5; q++){ const nx = q===5 ? b.b : b.a.clone().lerp(b.b, q/5).add(tv.set(rand(-1,1),rand(-1,1),rand(-1,1)).multiplyScalar(4)); line(last, nx, '#e8dcff', a); last = nx; }
    } else line(b.a, b.b, b.kind==='rail' ? '#d8c8ff' : b.kind==='epd' ? '#ff7a66' : '#c9adff', a);
  }
  const p = G.player;
  if (p && p.alive) for (const h of p.lasers) if (h.beam) line(h.beam[0], h.beam[1], '#9dff8a');
  for (const s of G.ships) if (s.alive && s.sights) for (const [at,dir] of s.sights) line(at, tv.copy(at).addScaledVector(dir, 700*G.S), '#ff3d3d', .5 + .5*Math.sin(G.time*30));
  lineGeo.setDrawRange(0, nl*2); (lineGeo.attributes.position as BufferAttribute).needsUpdate = true; (lineGeo.attributes.color as BufferAttribute).needsUpdate = true;
}
function syncFx(){
  let nb = 0, ns = 0, nd = 0, nk = 0;
  for (const f of G.fx){
    const a = clamp(f.life/f.max, 0, 1);
    if (f.k==='boom' && nb < 400){
      // fireball: white-hot first, then orange, then a fading red
      dummy.position.copy(f.p); dummy.quaternion.identity(); dummy.scale.setScalar(Math.max(.5, f.r*(1.25-a*.5))); dummy.updateMatrix();
      booms.setMatrixAt(nb, dummy.matrix); booms.setColorAt(nb, tcol.set(a > .7 ? '#fff0c0' : a > .35 ? '#ff9a3a' : '#a02a10').multiplyScalar(.4 + a)); nb++;
    } else if (f.k==='ring' && nb < 400){
      dummy.position.copy(f.p); dummy.quaternion.identity(); dummy.scale.setScalar(Math.max(1, f.r*(1.15-a))); dummy.updateMatrix();
      booms.setMatrixAt(nb, dummy.matrix); booms.setColorAt(nb, tcol.set(f.col).multiplyScalar(a*.35)); nb++;
    } else if (f.k==='smoke' && ns < 600){
      dummy.position.copy(f.p); dummy.quaternion.identity(); dummy.scale.setScalar(Math.max(.5, f.r*(1.6-a*.6))); dummy.updateMatrix();
      smokes.setMatrixAt(ns++, dummy.matrix);
    } else if (f.k==='deb' && nd < 1200){
      dummy.position.copy(f.p); dummy.quaternion.setFromAxisAngle(tv.copy(f.spin).normalize(), f.spin.length()*G.time); dummy.scale.setScalar(a); dummy.updateMatrix();
      debs.setMatrixAt(nd, dummy.matrix); debs.setColorAt(nd, tcol.set(f.col)); nd++;
    } else if (f.k==='spk' && nk < MAXS){
      sparkPos.set([f.p.x, f.p.y, f.p.z], nk*3); tcol.set(f.col).multiplyScalar(a); sparkCol.set([tcol.r, tcol.g, tcol.b], nk*3); nk++;
    }
  }
  booms.count = nb; smokes.count = ns; debs.count = nd;
  for (const o of [booms, smokes, debs]){ o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
  sparkGeo.setDrawRange(0, nk); (sparkGeo.attributes.position as BufferAttribute).needsUpdate = true; (sparkGeo.attributes.color as BufferAttribute).needsUpdate = true;
  // shield bubbles: the player's in blue, enemies' in orange, flashing white when hit
  let n = 0;
  for (const s of G.ships){
    if (!s.alive || (s.team!=='p' && s.team!=='e')) continue;
    for (const sb of s.shields){
      const B = sb.bub; if (!B || B.down > 0 || B.hp <= 0 || n >= 64) continue;
      const at = tv.set(sb.i*BS, sb.l*BS, sb.j*BS).applyQuaternion(s.q).add(s.p), fl = G.time - B.flash < .08;
      dummy.position.copy(at); dummy.quaternion.identity(); dummy.scale.setScalar(s.team==='p' ? shRad() : ESH.rad); dummy.updateMatrix();
      bubbles.setMatrixAt(n, dummy.matrix); bubbles.setColorAt(n, tcol.set(fl ? '#ffffff' : s.team==='p' ? '#5fd3ff' : '#ff9a5a').multiplyScalar(fl ? .8 : .12 + .25*B.hp/B.max)); n++;
    }
  }
  bubbles.count = n; bubbles.instanceMatrix.needsUpdate = true; if (bubbles.instanceColor) bubbles.instanceColor.needsUpdate = true;
}

// ---------- combat camera ----------
// Chase camera behind and above the player, turning with the ship a little late so turns read on screen.
const camQ = new Quaternion();
let camSnap = true;
export function resetCamera(){ camSnap = true; }
function chase(dt: number){
  const p = G.player; if (!p) return;
  if (camSnap){ camQ.copy(p.q); camSnap = false; }
  if (p.alive) camQ.slerp(p.q, Math.min(1, dt*4));
  const back = (p.r*2.4 + 90)*G.camMul, up = p.r*.7 + 26*G.camMul;
  const pos = tv.set(0, up, back).applyQuaternion(camQ).add(p.p);
  if (G.shake > .3) pos.add(tv2.set(rand(-1,1), rand(-1,1), rand(-1,1)).multiplyScalar(G.shake*2));
  camera.position.copy(pos);
  // look past the ship, so the screen centre is where the nose points
  const look = tv2.set(0, up*.35, -back*1.5).applyQuaternion(camQ).add(p.p);
  camera.up.copy(UP).applyQuaternion(camQ);
  camera.lookAt(look);
}
/** A ray from the camera through a point on the low-res canvas. */
export function cursorRay(x: number, y: number){
  camera.updateMatrixWorld();
  const ndc = new Vector2(x/W*2 - 1, -(y/H*2 - 1)), r = new Raycaster();
  r.setFromCamera(ndc, camera);
  return r.ray as Ray;
}
/** A world point on the low-res canvas, or null when behind the camera. */
export function project(p: Vector3){
  const v = tv.copy(p).project(camera);
  if (v.z > 1) return null;
  return {x:(v.x+1)/2*W, y:(1-v.y)/2*H};
}

// ---------- drydock ----------
const bBoxes = new InstancedMesh(BOX, hullMat, 4096), bBarrels = new InstancedMesh(BARREL_GEO, barrelMat, 1024);
const ghostMat = new MeshBasicMaterial({color:0x7fe07a, transparent:true, opacity:.45, depthWrite:false});
const ghost = new InstancedMesh(new BoxGeometry(BS*.98, BS*.98, BS*.98), ghostMat, 64);
const cursorBox = new LineSegments(new EdgesGeometry(new BoxGeometry(BS*1.04, BS*1.04, BS*1.04)), new LineBasicMaterial({color:0xffc46b}));
const floor = new Group(), RUST = new Color(.25,.08,0);
let bKeys: Key[] = [];
function makeFloor(){
  // a deck grid under the core's layer, with the fore direction marked
  const n = 24, pts: number[] = [];
  for (let q=-n; q<=n; q++){ pts.push(q*BS+BS/2, 0, -n*BS, q*BS+BS/2, 0, n*BS, -n*BS, 0, q*BS+BS/2, n*BS, 0, q*BS+BS/2); }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  const grid = new LineSegments(g, new LineBasicMaterial({color:0x34477e, transparent:true, opacity:.35}));
  grid.position.y = -BS/2; floor.add(grid);
  const ag = new BufferGeometry(); ag.setAttribute('position', new BufferAttribute(new Float32Array([0,0,-6*BS, 0,0,-16*BS, 0,0,-16*BS, -2*BS,0,-13*BS, 0,0,-16*BS, 2*BS,0,-13*BS]), 3));
  const arrow = new LineSegments(ag, new LineBasicMaterial({color:0xffc46b})); arrow.position.y = -BS/2; floor.add(arrow);
}
/** The drydock camera orbits the core; G.bDist zooms. */
function orbit(){
  let R = 0; for (const k of G.design.keys()) R = Math.max(R, Math.hypot(KI(k), KJ(k), KL(k)));
  const d = (R*BS + 40)*2.6*(G.bDist || 1);
  camera.position.set(Math.sin(G.bYaw)*Math.cos(G.bPitch), Math.sin(G.bPitch), Math.cos(G.bYaw)*Math.cos(G.bPitch)).multiplyScalar(d);
  camera.up.copy(UP); camera.lookAt(0,0,0);
}
function syncDesign(){
  bKeys = [...G.design.keys()];
  let nb = 0;
  bKeys.forEach((k, n) => {
    const t = G.design.get(k)!, i = KI(k), j = KJ(k), l = KL(k), o = G.dirs.get(k) || 0;
    dummy.position.set(i*BS, l*BS, j*BS); dummy.quaternion.identity(); dummy.scale.copy(one); dummy.updateMatrix();
    bBoxes.setMatrixAt(n, dummy.matrix);
    // damaged blocks show dark and rusty until repaired
    blockColor(t, 'p'); if (G.broken.has(k)) tcol.multiplyScalar(.35).add(RUST);
    if (G.grpBrush && isWeapon(t)) tcol.set(['#5fd8ff','#ffc46b','#ff7ad8','#9dff8a','#ff9a7a'][grpOf(k,t)-1]);
    bBoxes.setColorAt(n, tcol);
    if (BARREL[t] || t==='engine'){
      dummy.quaternion.copy(aimQ(t==='engine' ? DIRV[OPP[o]] : DIRV[o])); dummy.scale.set(1,1,t==='engine' ? .7 : BARREL[t] || 1); dummy.updateMatrix();
      if (nb < 1024) bBarrels.setMatrixAt(nb++, dummy.matrix);
    }
  });
  bBoxes.count = bKeys.length; bBarrels.count = nb;
  bBoxes.instanceMatrix.needsUpdate = true; if (bBoxes.instanceColor) bBoxes.instanceColor.needsUpdate = true; bBarrels.instanceMatrix.needsUpdate = true;
  // the placement ghost: every cell the next block (and its mirror twins) would fill
  const h = G.hover; let ng = 0;
  cursorBox.visible = !!h;
  if (h){
    const sell = G.drag==='sell' || G.sel==='sell';
    cursorBox.position.set(h.i*BS, h.l*BS, h.j*BS);
    (cursorBox.material as LineBasicMaterial).color.set(sell ? '#ff5a3a' : G.grpBrush ? '#ffffff' : '#ffc46b');
    if (!sell && !G.grpBrush){
      for (const [i,j,l,o] of placeSpots(h.ni, h.nj, h.nl, G.rot, G.sel)){
        const ok = placeCheck(i,j,l,G.sel,o) === true;
        for (const [a,b,c] of cellsFor(i,j,l,G.sel,T[G.sel].rot ? o : 0)){
          if (ng >= 64) break;
          dummy.position.set(a*BS, c*BS, b*BS); dummy.quaternion.identity(); dummy.scale.copy(one); dummy.updateMatrix();
          ghost.setMatrixAt(ng, dummy.matrix); ghost.setColorAt(ng, tcol.set(ok ? '#7fe07a' : '#ff5a3a')); ng++;
        }
      }
    }
  }
  ghost.count = ng; ghost.instanceMatrix.needsUpdate = true; if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
}
/** The block under the cursor in the drydock and the empty cell beside the face it was hit on. */
export function buildPick(x: number, y: number): BuildHover | null {
  orbit(); camera.updateMatrixWorld(); bBoxes.updateMatrixWorld();
  const r = new Raycaster(); r.setFromCamera(new Vector2(x/W*2 - 1, -(y/H*2 - 1)), camera);
  const hit = r.intersectObject(bBoxes, false).find(h => h.instanceId !== undefined && h.instanceId < bKeys.length);
  if (!hit || !hit.face) return null;
  const k = bKeys[hit.instanceId!], i = KI(k), j = KJ(k), l = KL(k), nrm = hit.face.normal;
  return {i, j, l, ni:i + Math.round(nrm.x), nj:j + Math.round(nrm.z), nl:l + Math.round(nrm.y)};
}

// ---------- frame ----------
let lastMode = '';
export function render3d(dt: number){
  if (!renderer) return;
  if (renderer.domElement.width !== W || renderer.domElement.height !== H){ renderer.setSize(W, H, false); camera.aspect = W/H; camera.updateProjectionMatrix(); }
  const fight = G.mode==='combat' || ((G.mode==='clear' || G.mode==='dead') && G.player);
  if (G.mode !== lastMode){ if (G.mode==='combat') resetCamera(); lastMode = G.mode; }
  if (G.mode==='build'){
    orbit(); syncDesign();
    sky.position.copy(camera.position);
    renderer.render(buildScene, camera);
    return;
  }
  if (fight){
    chase(dt); syncShips(); syncProjectiles(); syncFx();
    arena.visible = true; arena.scale.set(G.AW, G.AH, G.AD);
  } else {
    // title and star map: a slow drift through the starfield
    for (const [, m] of meshes) disposeMesh(m); meshes.clear();
    bolts.count = 0; booms.count = 0; smokes.count = 0; debs.count = 0; bubbles.count = 0; sparkGeo.setDrawRange(0, 0); lineGeo.setDrawRange(0, 0);
    arena.visible = false;
    camera.position.set(0,0,0); camera.up.copy(UP); camera.lookAt(Math.sin(G.time*.02), Math.sin(G.time*.013)*.2, -Math.cos(G.time*.02));
  }
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}
/** Where the hull blocks of the design are on screen (drydock), for markers drawn on the overlay. */
export function projectCell(i: number, j: number, l: number){
  return project(tv2.set(i*BS, l*BS, j*BS));
}
export const facingName = (o: Facing) => ['fore','starboard','aft','port','up','down'][o];

// wiring that runs once at start-up
export function init(){
  try {
    renderer = new WebGLRenderer({canvas:$<HTMLCanvasElement>('gl'), antialias:false, powerPreference:'high-performance'});
    renderer.setPixelRatio(1); renderer.setClearColor(0x04050b, 1);
  } catch { renderer = null; }
  makeSky(); makeFloor();
  lights(scene); scene.add(sky, bolts, booms, smokes, debs, bubbles, sparkPts, lines, arena);
  lights(buildScene); buildScene.add(bBoxes, bBarrels, ghost, cursorBox, floor);
}
