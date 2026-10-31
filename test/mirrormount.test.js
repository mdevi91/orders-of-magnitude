// Mirror building and mounts: for every turret, in every mirror mode, a mount picked on the card, a mount fitted from
// cargo and a refit all reach each twin, with the arc angle mirrored.
const W = ['cannon','gatling','hgatling','plasma','bigcannon','laser','glimmer','rail'].filter(t => turns(t));
const MODES = {1:'left/right', 2:'fore/aft', 3:'four-way'};
function hullBed(){
  const d = new Map([[CORE,'core']]);
  for (let i=-3; i<=3; i++) for (const j of [-1,0,1]) if (i || j) d.set(K(i,j), 'hull');
  return d;
}
function setup(mir){
  fresh(); G.stage = 12; G.outfit = false; G.mir = mir; G.credits = 0;
  G.design = hullBed(); G.dirs = new Map(); G.broken = new Set(); G.mnt = {}; G.ang = {}; G.selMk = null; G.selAng = 0; G.rot = 0;
}
const heads = t => [...G.design].filter(([, c]) => c===t).map(([k]) => k);
const show = () => JSON.stringify([[...G.design].filter(([, c]) => !['hull','core'].includes(c)).map(([k,c]) => [KI(k),KJ(k),c]), G.mnt, G.ang, G.inv]);
for (const t of W) for (const mir of [1,2,3]){
  // the head sits so the part's tail touches the top row of the hull
  const name = `${t} ${MODES[mir]}`, x = -2, y = -2 - Math.max(...cellsFor(0,0,t,0).map(c => c[1]));
  // picked on the card, then placed
  setup(mir); G.inv = {[t]:4, mgimbal:4}; G.sel = t; G.selMk = 'gimbal'; G.selAng = 1;
  buildAction(x, y, 'place', false);
  let hs = heads(t);
  ok(`${name}: placed on the picked mount, every twin`, hs.length > 1 && hs.every(k => G.mnt[k]==='gimbal'), show());
  ok(`${name}: one item used per twin`, G.inv.mgimbal === 4 - hs.length, show());
  // a mount item fitted onto placed weapons
  setup(mir); G.inv = {[t]:4, mgimbal:4}; G.sel = t;
  buildAction(x, y, 'place', false);
  hs = heads(t);
  G.sel = 'mgimbal'; buildAction(x, y, 'place', true);
  ok(`${name}: a fitted mount reaches every twin`, hs.length > 1 && hs.every(k => G.mnt[k]==='gimbal'), show());
  buildAction(x, y, 'place', true);
  ok(`${name}: a tap angles every twin`, hs.every(k => Math.abs(G.ang[k] || 0)===1), show());
  // a tap with the weapon selected and a mount picked moves the twins as well
  setup(mir); G.inv = {[t]:4, mring:4}; G.sel = t;
  buildAction(x, y, 'place', false);
  hs = heads(t); G.selMk = 'ring'; G.selAng = 2;
  buildAction(x, y, 'place', true);
  ok(`${name}: a refit reaches every twin`, hs.every(k => G.mnt[k]==='ring' && Math.abs(G.ang[k] || 0)===2), show());
}
// twins out of step: the weapon clicked already matches, its twin does not
const L = K(-2,-2), R = K(2,-2);
function pair(){ setup(1); G.design.set(L,'cannon'); G.design.set(R,'cannon'); G.dirs.set(L,0); G.dirs.set(R,0); }
pair(); G.mnt = {[L]:'ring'}; G.ang = {[L]:2}; G.inv = {mring:1}; G.sel = 'cannon'; G.selMk = 'ring'; G.selAng = 2;
buildAction(-2, -2, 'place', true);
ok('a tap on a matching weapon brings its twin into step', G.mnt[R]==='ring' && G.ang[R]===-2 && (G.dirs.get(L) || 0)===0, show());
pair(); G.mnt = {[L]:'ring'}; G.ang = {[L]:2}; G.inv = {mring:1}; G.sel = 'mring';
buildAction(-2, -2, 'place', false);
ok('fitting a mount onto a twin copies the arc angle, mirrored', G.mnt[R]==='ring' && G.ang[R]===-2, show());
pair(); G.sel = 'cannon'; G.selMk = 'ring'; G.selAng = 1; G.inv = {cannon:1, mring:2}; G.design.delete(L); G.dirs.delete(L);
buildAction(-2, -2, 'place', false);
ok('placing beside a twin already down moves the twin onto the picked mount', G.mnt[L]==='ring' && G.mnt[R]==='ring' && G.ang[L]===1 && G.ang[R]===-1, show());
// not enough items for every twin: the toast says so, and the weapon clicked gets the one there is
setup(1); G.inv = {cannon:2, mring:1}; G.sel = 'cannon'; G.selMk = 'ring';
buildAction(-2, -2, 'place', false);
ok('one item between two twins goes on the weapon clicked', G.mnt[L]==='ring' && !G.mnt[R] && !G.inv.mring, show());
