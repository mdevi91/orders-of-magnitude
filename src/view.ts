// The canvas and the page elements every module reaches for.

/** An element the page markup is known to contain (index.html). */
export const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
export const cv = $<HTMLCanvasElement>('c'), ctx = cv.getContext('2d')!;
// The game renders into a low-res buffer that CSS scales up with nearest-neighbour: every canvas pixel is PX screen pixels.
export let W = 0, H = 0, PX = 3, DPR = 1;
export const hi = $<HTMLCanvasElement>('hi'), hctx = hi.getContext('2d')!;
export function resize(){
  PX = innerWidth < 760 ? 2 : 3; W = Math.ceil(innerWidth/PX); H = Math.ceil(innerHeight/PX); cv.width = W; cv.height = H;
  DPR = Math.min(2, window.devicePixelRatio || 1); hi.width = Math.round(innerWidth*DPR); hi.height = Math.round(innerHeight*DPR);
}
export const FONT = (s: number) => `${s}px "Press Start 2P", "Courier New", monospace`;
export const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

// wiring that runs once at start-up
export function init(){
  addEventListener('resize', resize); resize();
}
