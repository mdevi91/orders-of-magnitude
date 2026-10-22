// @ts-nocheck
import { updateFx } from './craft';
import { drawSpace, renderBuild, renderCombat } from './draw';
import { renderMap } from './mapdraw';
import { G } from './state';
import { syncHud } from './ui';
import { update } from './update';
import { H, W, ctx, hctx, hi } from './view';

export let lastT = performance.now();
export function frame(now){
  // schedule first, so an error in one frame can never stop the loop
  requestAnimationFrame(frame);
  const dt = Math.min(.033, (now-lastT)/1000); lastT = now;
  try {
    if (G.mode==='combat' && !G.paused) update(dt);
    else if (G.mode==='clear' || G.mode==='dead') { G.time += dt; updateFx(dt); }
    else G.time += dt;
    ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05060c'; ctx.fillRect(0,0,W,H);
    const clearHi = () => { hctx.setTransform(1,0,0,1,0,0); hctx.clearRect(0,0,hi.width,hi.height); };
    if (G.mode==='build'){ clearHi(); renderBuild(); }
    else if (G.mode==='map'){ clearHi(); renderMap(); }
    else if (G.mode==='title' || !G.player){ clearHi(); drawSpace(G.time*14, 0, 1); }
    else renderCombat();
    syncHud();
  } catch (err) { console.error(err); }
}
