import './styles.css';
import { init as init_audio } from './audio';
import { init as init_blueprints } from './blueprints';
import { init as init_catalog } from './catalog';
import { init as init_controls } from './controls';
import { init as init_groups } from './groups';
import { init as init_input } from './input';
import { frame } from './loop';
import { showTitle } from './runs';
import { init as init_save, load, loadMeta } from './save';
import { init as init_state } from './state';
import { init as init_tutorial } from './tutorial';
import { buildPalette, init as init_ui } from './ui';
import { $, init as init_view } from './view';

init_view();
init_catalog();
init_state();
init_input();
init_audio();
init_ui();
init_blueprints();
init_save();
init_controls();
init_groups();
init_tutorial();

const splash = $('splash');
function endSplash(){ if (!splash.isConnected) return; splash.remove(); removeEventListener('keydown', skipKey, true); }
function skipKey(e: KeyboardEvent){ e.stopImmediatePropagation(); e.preventDefault(); endSplash(); }
addEventListener('keydown', skipKey, true);
splash.addEventListener('pointerdown', e => { e.stopPropagation(); endSplash(); });
splash.addEventListener('animationend', e => { if (e.target === splash) endSplash(); });
if (innerWidth < 760){ $<HTMLDetailsElement>('help').open = false; $<HTMLDetailsElement>('statsBox').open = false; }

loadMeta(); load(); buildPalette(); showTitle();
requestAnimationFrame(frame);

// test builds expose every module to the test runner (see test/run.js)
if (import.meta.env.MODE === 'test'){
  const all = Object.values(import.meta.glob(['./*.ts', '!./main.ts'], { eager: true }));
  (window as unknown as {OOM: object}).OOM = new Proxy({}, {
    has: (_, k) => all.some(m => k in (m as object)),
    get: (_, k) => { for (const m of all) if (k in (m as object)) return (m as Record<string | symbol, unknown>)[k]; },
  });
}
