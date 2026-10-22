import { updateFx } from './craft';
import { renderBuildOverlay, renderCombatOverlay, syncTip } from './draw';
import { renderMap } from './mapdraw';
import { render3d } from './render3d';
import { G } from './state';
import { syncHud } from './ui';
import { update } from './update';
import { H, W, ctx, hctx, hi } from './view';

export let lastT = performance.now();
export function frame(now: number){
  // schedule first, so an error in one frame can never stop the loop
  requestAnimationFrame(frame);
  const dt = Math.min(.033, (now-lastT)/1000); lastT = now;
  try {
    if (G.mode==='combat' && !G.paused) update(dt);
    else if (G.mode==='clear' || G.mode==='dead') { G.time += dt; updateFx(dt); }
    else G.time += dt;
    // the 3D view underneath, then the 2D overlay: HUD markers in a fight, block markers in the drydock, the whole star map
    render3d(dt);
    ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0,0,W,H);
    hctx.setTransform(1,0,0,1,0,0); hctx.clearRect(0,0,hi.width,hi.height);
    if (G.mode==='build') renderBuildOverlay();
    else if (G.mode==='map') renderMap();
    else if (G.mode!=='title' && G.player) renderCombatOverlay();
    syncHud(); syncTip();
  } catch (err) { console.error(err); }
}
