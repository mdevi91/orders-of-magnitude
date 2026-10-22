// The 3D view: one WebGL scene for fights, the title and the star map backdrop, and one for the drydock.
// It renders at the game's low pixel resolution and CSS scales it up, so the voxels keep a pixel-art edge.
import {
  AdditiveBlending, AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, DirectionalLight, DynamicDrawUsage,
  EdgesGeometry, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, MeshBasicMaterial,
  MeshLambertMaterial, NearestFilter, Object3D, PerspectiveCamera, Points, PointsMaterial, Quaternion, Ray, Raycaster, SRGBColorSpace, Scene, Sprite, SpriteMaterial,
  Vector2, Vector3, WebGLRenderer,
} from 'three';
import { BCOL, COL, ESH, HEAD_OF, PARTS, T, def, grpOf, isWeapon, shRad } from './catalog';
import { drawBlock } from './draw';
import { cellsFor, placeCheck, placeSpots } from './editor';
import { BS, DIRV, FACE, KI, KJ, KL, OPP, clamp, rand } from './grid';
import { G } from './state';
import type { Block, BlockType, BuildHover, Cell, Facing, Key, Ship, Team } from './types';
import { $, H, W } from './view';

// ---------- renderer and scenes ----------
export let renderer: WebGLRenderer | null = null;
export const camera = new PerspectiveCamera(60, 16/9, 2, 60000);
const scene = new Scene(), buildScene = new Scene();
const UP = new Vector3(0,1,0);
const tq = new Quaternion(), tv = new Vector3(), tv2 = new Vector3(), tcol = new Color(), one = new Vector3(1,1,1);

/** Turrets and fixed weapons get a barrel; engines get a nozzle. */
const BARREL: Partial<Record<Cell, number>> = {cannon:.9, gatling:1, scatter:.7, flak:.8, ion:.9, torpedo:1.1, rail:1.4, laser:1.1, core:.6};

function lights(s: Scene){
  s.add(new AmbientLight(0x505a70, 1.8));
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

/// ---------- ships ----------
// Every block type wears its pixel-art icon (the palette's sprite) on all six faces, so a cannon reads as a cannon from any side.
const BOX = new BoxGeometry(BS*.94, BS*.94, BS*.94);
const BARREL_GEO = new BoxGeometry(BS*.24, BS*.24, BS).translate(0, 0, -BS*.5);
const FLAME_GEO = new BoxGeometry(BS*.5, BS*.5, BS*.9).translate(0, 0, BS*.45);
const barrelMat = new MeshLambertMaterial({color:0xc8d0dc});
const flameMat = new MeshBasicMaterial({color:0xffa040, blending:AdditiveBlending, transparent:true, depthWrite:false});
const texCache = new Map<string, CanvasTexture>(), matCache = new Map<string, MeshLambertMaterial>();
function iconTex(t: Cell, team: Team){
  const key = team + t; let tx = texCache.get(key); if (tx) return tx;
  const c = document.createElement('canvas'); c.width = c.height = 20;
  const x = c.getContext('2d')!; x.setTransform(2,0,0,2,10,10); x.lineWidth = .5;
  drawBlock(x, t, 0, team==='e' ? 'e' : 'p', 0, 0, -Math.PI/2, false, 1, true, t==='engine');
  tx = new CanvasTexture(c); tx.magFilter = tx.minFilter = NearestFilter; tx.generateMipmaps = false; tx.colorSpace = SRGBColorSpace;
  texCache.set(key, tx); return tx;
}
/** The textured material for a block type, shared by every ship of that side; instance colours tint it. */
export function blockMat(t: Cell, team: Team){
  const key = team + t; let m = matCache.get(key);
  if (!m){ m = new MeshLambertMaterial({map:iconTex(t, team)}); matCache.set(key, m); }
  return m;
}
interface ShipMesh { g: Group; parts: Map<InstancedMesh, Block[]>; at: Map<Block, [InstancedMesh, number]>; barrels: InstancedMesh; flames: InstancedMesh; ver: number; guns: Block[]; engines: Block[]; flash: Set<Block> }
const meshes = new Map<Ship, ShipMesh>();
const dummy = new Object3D();
/** The rotation that points local -z along a direction. */
const aimQ = (dir: Vector3, out = tq) => out.setFromUnitVectors(tv2.set(0,0,-1), dir);
/** Each type's own colour washed over its icon, so blocks tell apart at a glance; plating stays bare steel (or rust). */
export function typeTint(t: Cell, team: Team, out = tcol){
  out.setRGB(1,1,1);
  if (t==='hull' || t==='armor') return team==='e' ? out.set('#e0907a') : out;
  const c = COL[team][t] || COL.p[t];
  return c ? out.lerp(new Color(c), .55) : out;
}
/** Instance tint for a block: its type colour, darkened by battle damage. */
function shade(b: Block, team: Team){ const k = b.hp/b.max; return typeTint(b.t, team).multiplyScalar(k < .7 ? .45 + .55*k/.7 : 1); }

function buildShipMesh(s: Ship): ShipMesh {
  const blocks = [...s.blocks.values()], guns = blocks.filter(b => BARREL[b.t]), engines = blocks.filter(b => b.t==='engine');
  const g = new Group(), parts = new Map<InstancedMesh, Block[]>(), at = new Map<Block, [InstancedMesh, number]>();
  const byType = new Map<Cell, Block[]>();
  for (const b of blocks) (byType.get(b.t) || byType.set(b.t, []).get(b.t)!).push(b);
  for (const [t, list] of byType){
    const mesh = new InstancedMesh(BOX, blockMat(t, s.team), list.length);
    list.forEach((b, n) => {
      dummy.position.set(b.i*BS, b.l*BS, b.j*BS); dummy.quaternion.identity(); dummy.scale.copy(one); dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix); mesh.setColorAt(n, shade(b, s.team)); at.set(b, [mesh, n]);
    });
    parts.set(mesh, list); g.add(mesh);
  }
  const barrels = new InstancedMesh(BARREL_GEO, barrelMat, Math.max(1, guns.length));
  const flames = new InstancedMesh(FLAME_GEO, flameMat, Math.max(1, engines.length));
  barrels.count = guns.length; flames.count = engines.length;
  barrels.instanceMatrix.setUsage(DynamicDrawUsage); flames.instanceMatrix.setUsage(DynamicDrawUsage);
  g.add(barrels, flames); scene.add(g);
  return {g, parts, at, barrels, flames, ver:s.ver, guns, engines, flash:new Set()};
}
function disposeMesh(m: ShipMesh){ scene.remove(m.g); for (const mesh of m.parts.keys()) mesh.dispose(); m.barrels.dispose(); m.flames.dispose(); }
function syncShips(){
  const live = new Set(G.ships.filter(s => s.alive));
  for (const [s,m] of meshes) if (!live.has(s)){ disposeMesh(m); meshes.delete(s); }
  const p = G.player;
  for (const s of live){
    let m = meshes.get(s);
    if (!m || m.ver !== s.ver){ if (m) disposeMesh(m); m = buildShipMesh(s); meshes.set(s, m); }
    m.g.position.copy(s.p); m.g.quaternion.copy(s.q);
    // white flash on hit, then back to the damaged tint
    for (const [mesh, list] of m.parts){
      let dirty = false;
      list.forEach((b, n) => {
        const hot = G.time - b.hit < .06;
        if (hot){ mesh.setColorAt(n, tcol.setRGB(3,3,3)); m!.flash.add(b); dirty = true; }
        else if (m!.flash.has(b)){ mesh.setColorAt(n, shade(b, s.team)); m!.flash.delete(b); dirty = true; }
      });
      if (dirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
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

/// ---------- drydock ----------
// One instanced mesh per block type, reused frame to frame; picking maps each instance back to its cell.
const dockMeshes = new Map<BlockType, InstancedMesh>(), dockKeys = new Map<InstancedMesh, Key[]>();
function dockMesh(t: BlockType){
  let m = dockMeshes.get(t);
  if (!m){ m = new InstancedMesh(BOX, blockMat(t, 'p'), 1024); m.frustumCulled = false; dockMeshes.set(t, m); dockKeys.set(m, []); buildScene.add(m); }
  return m;
}
const bBarrels = new InstancedMesh(BARREL_GEO, barrelMat, 1024);
// The placement preview: the block itself, see-through and pulsing (red where it can't go), with an arrow for its facing.
const ghostMeshes = new Map<BlockType, InstancedMesh>();
function ghostMesh(t: BlockType){
  let m = ghostMeshes.get(t);
  if (!m){
    m = new InstancedMesh(new BoxGeometry(BS*.99, BS*.99, BS*.99), new MeshLambertMaterial({map:iconTex(t, 'p'), transparent:true, opacity:.7, depthWrite:false, emissive:0x404020}), 64);
    m.frustumCulled = false; ghostMeshes.set(t, m); buildScene.add(m);
  }
  return m;
}
const arrows = new InstancedMesh(new ConeGeometry(BS*.32, BS*.9, 8).rotateX(-Math.PI/2), new MeshBasicMaterial({color:0xffe08a}), 8);
// where the new block goes (gold box) and what it attaches to (white box); in remove mode a red box on the block
const cursorBox = new LineSegments(new EdgesGeometry(new BoxGeometry(BS*1.06, BS*1.06, BS*1.06)), new LineBasicMaterial({color:0xffc46b}));
const attachBox = new LineSegments(new EdgesGeometry(new BoxGeometry(BS*1.02, BS*1.02, BS*1.02)), new LineBasicMaterial({color:0xffffff, transparent:true, opacity:.6}));
const floor = new Group();
const GROUP_COL = ['#5fd8ff','#ffc46b','#ff7ad8','#9dff8a','#ff9a7a'];
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
  const d = (R*BS + 22)*2.2*(G.bDist || 1);
  camera.position.set(Math.sin(G.bYaw)*Math.cos(G.bPitch), Math.sin(G.bPitch), Math.cos(G.bYaw)*Math.cos(G.bPitch)).multiplyScalar(d);
  camera.up.copy(UP); camera.lookAt(0,0,0);
}
function syncDesign(){
  for (const [m, keys] of dockKeys){ m.count = 0; keys.length = 0; }
  // blocks of the selected type pulse brighter, so you can see where they all are
  const pulse = 1.15 + .3*Math.sin(G.time*5);
  let nb = 0;
  for (const [k,t] of G.design){
    const i = KI(k), j = KJ(k), l = KL(k), o = G.dirs.get(k) || 0, m = dockMesh(t), n = m.count++;
    dockKeys.get(m)!.push(k);
    dummy.position.set(i*BS, l*BS, j*BS); dummy.quaternion.identity(); dummy.scale.copy(one); dummy.updateMatrix();
    m.setMatrixAt(n, dummy.matrix);
    // damaged blocks show dark and rusty until repaired; while assigning groups, weapons wear their group's colour
    if (G.broken.has(k)) tcol.setRGB(.5,.3,.25);
    else if (G.grpBrush) tcol.set(isWeapon(t) ? GROUP_COL[grpOf(k,t)-1] : '#555a66');
    else typeTint(t, 'p').multiplyScalar(t===G.sel || HEAD_OF[t]===G.sel ? pulse : 1);
    m.setColorAt(n, tcol);
    if (BARREL[t] || t==='engine'){
      dummy.quaternion.copy(aimQ(t==='engine' ? DIRV[OPP[o]] : DIRV[o])); dummy.scale.set(1,1,t==='engine' ? .7 : BARREL[t] || 1); dummy.updateMatrix();
      if (nb < 1024) bBarrels.setMatrixAt(nb++, dummy.matrix);
    }
  }
  for (const m of dockMeshes.values()){ m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  bBarrels.count = nb; bBarrels.instanceMatrix.needsUpdate = true;
  // the preview
  for (const m of ghostMeshes.values()) m.count = 0;
  let na = 0;
  const h = G.hover, sell = G.drag==='sell' || G.sel==='sell';
  cursorBox.visible = attachBox.visible = !!h;
  if (h){
    if (sell || G.grpBrush){
      cursorBox.position.set(h.i*BS, h.l*BS, h.j*BS); attachBox.visible = false;
      (cursorBox.material as LineBasicMaterial).color.set(sell ? '#ff5a3a' : '#ffffff');
    } else {
      cursorBox.position.set(h.ni*BS, h.nl*BS, h.nj*BS); attachBox.position.set(h.i*BS, h.l*BS, h.j*BS);
      const spots = placeSpots(h.ni, h.nj, h.nl, G.rot, G.sel), ok0 = placeCheck(spots[0][0], spots[0][1], spots[0][2], G.sel, spots[0][3]) === true;
      (cursorBox.material as LineBasicMaterial).color.set(ok0 ? '#ffc46b' : '#ff5a3a');
      const glow = .55 + .25*Math.sin(G.time*8);
      for (const [i,j,l,o] of spots){
        const ok = placeCheck(i,j,l,G.sel,o) === true, oo = T[G.sel].rot ? o : 0;
        for (const [a,b,c,ct] of cellsFor(i,j,l,G.sel,oo)){
          const m = ghostMesh(ct as BlockType); if (m.count >= 64) continue;
          dummy.position.set(a*BS, c*BS, b*BS); dummy.quaternion.identity(); dummy.scale.copy(one); dummy.updateMatrix();
          m.setMatrixAt(m.count, dummy.matrix); m.setColorAt(m.count, ok ? tcol.setRGB(1.2,1.2,1.2) : tcol.setRGB(1.4,.25,.2)); m.count++;
          (m.material as MeshLambertMaterial).opacity = glow;
        }
        if (T[G.sel].rot && na < 8){
          // an arrow out of the facing side of the new block
          dummy.position.set(i*BS, l*BS, j*BS).addScaledVector(DIRV[oo], BS*.95); aimQ(DIRV[oo], dummy.quaternion); dummy.scale.copy(one); dummy.updateMatrix();
          arrows.setMatrixAt(na++, dummy.matrix);
        }
      }
    }
  }
  for (const m of ghostMeshes.values()){ m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  arrows.count = na; arrows.instanceMatrix.needsUpdate = true;
}
/** The block under the cursor in the drydock and the empty cell beside the face it was hit on. */
export function buildPick(x: number, y: number): BuildHover | null {
  orbit(); camera.updateMatrixWorld();
  const r = new Raycaster(); r.setFromCamera(new Vector2(x/W*2 - 1, -(y/H*2 - 1)), camera);
  const live = [...dockMeshes.values()].filter(m => m.count > 0);
  for (const m of live) m.updateMatrixWorld();
  const hit = r.intersectObjects(live, false).find(h => h.instanceId !== undefined && h.instanceId < (h.object as InstancedMesh).count);
  if (!hit || !hit.face) return null;
  const k = dockKeys.get(hit.object as InstancedMesh)![hit.instanceId!], i = KI(k), j = KJ(k), l = KL(k), nrm = hit.face.normal;
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
  lights(buildScene); buildScene.add(bBarrels, arrows, cursorBox, attachBox, floor);
}
