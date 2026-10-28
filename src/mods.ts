// Mods made in the mod editor (mod-editor.html, `npm run mods`): pixel-art sprites that replace the drawn ones, and new
// wording for any text the game shows. Both live in src/mods.json, so they ship with every build.
import data from './mods.json';

/** A pixel sprite: rows of palette indices ('.' is see-through), drawn over box [x0, y0, x1, y1] in the sprite's own units. */
export interface ModSprite { box: [number, number, number, number]; pal: string[]; px: string[] }
export interface ModData { sprites: Record<string, ModSprite>; labels: Record<string, string> }
export const MODS = data as unknown as ModData;
/** Set while the mod editor bakes the game's own drawings, so no override sneaks into a default; noPlate leaves a
 * block's plating out so its part can be baked on its own. */
export const BAKE = { on: false, noPlate: false };

// ---------- sprites ----------
/** Palette index of a pixel code: one base-36 digit per pixel, or two when the palette is bigger than 36 colours. */
export const pxWidth = (pal: string[]) => pal.length > 36 ? 2 : 1;
export function decode(s: ModSprite){
  const d = pxWidth(s.pal), h = s.px.length, w = h ? s.px[0].length/d : 0;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    const code = s.px[y].slice(x*d, x*d + d); if (code[0] === '.') continue;
    g.fillStyle = s.pal[parseInt(code, 36)] || '#ff00ff'; g.fillRect(x, y, 1, 1);
  }
  return c;
}
export function encode(img: ImageData, box: ModSprite['box']): ModSprite {
  const pal: string[] = [], at = new Map<string, number>(), idx: number[] = [];
  for (let n=0; n<img.data.length; n+=4){
    const a = img.data[n+3]; if (!a){ idx.push(-1); continue; }
    const hex = '#' + [img.data[n], img.data[n+1], img.data[n+2]].map(v => v.toString(16).padStart(2, '0')).join('') + (a < 255 ? a.toString(16).padStart(2, '0') : '');
    let i = at.get(hex); if (i === undefined){ i = pal.length; pal.push(hex); at.set(hex, i); }
    idx.push(i);
  }
  const d = pxWidth(pal), px: string[] = [];
  for (let y=0; y<img.height; y++){
    let row = '';
    for (let x=0; x<img.width; x++){ const i = idx[y*img.width + x]; row += i < 0 ? '.'.repeat(d) : i.toString(36).padStart(d, '0'); }
    px.push(row);
  }
  return { box, pal, px };
}
const decoded = new Map<string, HTMLCanvasElement>(), tinted = new Map<string, HTMLCanvasElement>();
/** The replacement picture for sprite `id`, or null to draw the game's own. */
export function spr(id: string): HTMLCanvasElement | null {
  if (BAKE.on) return null;
  const s = MODS.sprites[id]; if (!s) return null;
  let c = decoded.get(id); if (!c){ c = decode(s); decoded.set(id, c); }
  return c;
}
/** Swaps in (or with null, drops) one sprite while the mod editor paints it. */
export function setSprite(id: string, sp: ModSprite | null){
  if (sp) MODS.sprites[id] = sp; else delete MODS.sprites[id];
  decoded.delete(id);
  for (const k of [...tinted.keys()]) if (k.startsWith(id + '|')) tinted.delete(k);
}

// ---------- tints ----------
// One sprite serves every paint scheme and both sides: it is painted in the player's steel look, and tinted in game by a
// gradient map. Each pixel takes the colour of dst at the point where its brightness sits among the src colours, so the
// steel shades become the paint's (or the enemy's rust) shade for shade. Saturated accents (glass, glow, stripes) that
// are not one of the src colours keep their own colour.
export interface Tint { key: string; src: string[]; dst: string[] }
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lum = (c: number[]) => (.299*c[0] + .587*c[1] + .114*c[2])/255;
function tintPixels(im: HTMLCanvasElement, t: Tint){
  const stops = t.src.map((s, i) => ({src: rgb(s), dst: rgb(t.dst[i]), L: lum(rgb(s))})).sort((a, b) => a.L - b.L);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d')!; g.drawImage(im, 0, 0);
  if (!im.width || !im.height) return c;
  const img = g.getImageData(0, 0, c.width, c.height), D = img.data;
  const lo = stops[0], hi = stops[stops.length - 1];
  for (let n=0; n<D.length; n+=4){
    if (!D[n+3]) continue;
    const px = [D[n], D[n+1], D[n+2]], L = lum(px);
    let out: number[];
    if (L <= lo.L) out = lo.dst.map(v => v*(lo.L ? L/lo.L : 1));
    else if (L >= hi.L) out = hi.dst.map(v => v + (255 - v)*(hi.L < 1 ? (L - hi.L)/(1 - hi.L) : 0));
    else {
      let q = 0; while (stops[q+1].L < L) q++;
      const a = stops[q], b = stops[q+1], f = (L - a.L)/((b.L - a.L) || 1);
      out = a.dst.map((v, i) => v + (b.dst[i] - v)*f);
    }
    // a src colour (or close to one) is mapped in full; otherwise grey takes the tint and colour keeps itself
    const near = Math.min(...stops.map(s => Math.hypot(px[0]-s.src[0], px[1]-s.src[1], px[2]-s.src[2])));
    const chroma = (Math.max(...px) - Math.min(...px))/255;
    const w = Math.max(1 - near/60, Math.min(1, Math.max(0, 1 - (chroma - .18)/.3)));
    for (let i=0; i<3; i++) D[n+i] = Math.round(px[i] + (out[i] - px[i])*w);
  }
  g.putImageData(img, 0, 0); return c;
}
/** Sprite `id`, tinted (see Tint); untinted with no tint. */
export function sprTinted(id: string, t?: Tint): HTMLCanvasElement | null {
  const im = spr(id); if (!im || !t) return im;
  const k = id + '|' + t.key; let c = tinted.get(k);
  if (!c){ c = tintPixels(im, t); tinted.set(k, c); }
  return c;
}
/** Whether sprite `id` is modded. */
export const hasSpr = (id: string) => !BAKE.on && !!MODS.sprites[id];
/** Draws modded sprite `id` at x, y turned by a, crisp, tinted by t if given; k scales its box (bullets are sized by their round). */
export function blit(X: CanvasRenderingContext2D, id: string, x: number, y: number, a = 0, k = 1, t?: Tint){
  const im = sprTinted(id, t); if (!im) return;
  const [x0, y0, x1, y1] = MODS.sprites[id].box, sm = X.imageSmoothingEnabled;
  X.save(); X.translate(x, y); if (a) X.rotate(a);
  X.imageSmoothingEnabled = false; X.drawImage(im, x0*k, y0*k, (x1-x0)*k, (y1-y0)*k); X.imageSmoothingEnabled = sm;
  X.restore();
}

// ---------- labels ----------
// Keys are the text as written in the source, with {0}, {1}... where the code fills something in; text built by joining
// strings with + is matched as a piece inside longer text. Text the code turns to capitals still matches, and gets the new
// wording in capitals. Every bit of text on the page and on the canvas passes through.
let exact = new Map<string, string>(), upper = new Map<string, string>(), pats: {re: RegExp; out: string}[] = [], parts: [string, string][] = [];
const memo = new Map<string, string>();
const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
export function setLabels(labels: Record<string, string>){
  exact = new Map(); upper = new Map(); pats = []; parts = []; memo.clear();
  for (const [k, v] of Object.entries(labels)){
    if (k.startsWith('+')){ parts.push([k.slice(1), v]); continue; }
    if (/\{\d+\}/.test(k)) pats.push({re: new RegExp('^' + esc(k).replace(/\\\{(\d+)\\\}/g, '([\\s\\S]*?)') + '$', 'i'), out: v});
    else { exact.set(k, v); upper.set(k.toUpperCase(), v.toUpperCase()); }
  }
  // longer patterns first, so the most specific one wins
  pats.sort((a, b) => b.re.source.length - a.re.source.length);
}
/** The game's text with the mod's wording swapped in. */
export function relabel(s: string): string {
  if (!s || (!exact.size && !pats.length && !parts.length)) return s;
  const hit = memo.get(s); if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!, core = m[2];
  const caps = /[A-Z]/.test(core) && !/[a-z]/.test(core);
  let out = exact.get(core) ?? (caps ? upper.get(core) : undefined);
  if (out === undefined) for (const p of pats){
    const r = p.re.exec(core); if (!r) continue;
    // each filled-in slot gets its own text relabelled too
    const words = caps ? p.out.toUpperCase() : p.out;
    out = words.replace(/\{(\d+)\}/g, (_, i) => relabel(r[+i + 1] ?? ''));
    break;
  }
  if (out === undefined){ out = core; for (const [a, b] of parts) if (out.includes(a)) out = out.split(a).join(b); }
  const res = m[1] + out + m[3];
  if (memo.size > 4000) memo.clear();
  memo.set(s, res); return res;
}
// text nodes and the attributes people read, kept in their modded wording as the game rewrites them
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const mine = new WeakMap<Node, string>();
function fixText(n: Text){
  if (n.data === mine.get(n)) return;
  const p = n.parentNode; if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) return;
  const t = relabel(n.data); if (t !== n.data){ mine.set(n, t); n.data = t; }
}
function fixEl(e: Element){
  for (const a of ATTRS){ const v = e.getAttribute(a); if (v){ const t = relabel(v); if (t !== v) e.setAttribute(a, t); } }
  if (e instanceof HTMLInputElement && (e.type === 'button' || e.type === 'submit') && e.value){ const t = relabel(e.value); if (t !== e.value) e.value = t; }
}
function fixTree(root: Node){
  if (root.nodeType === 3){ fixText(root as Text); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) fixEl(root as Element);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeType === 3) fixText(n as Text); else fixEl(n as Element);
}

// Saving in the mod editor rewrites mods.json: the game reloads to pick it up, the editor (which sets EDITOR) carries on.
export const EDITOR = { on: false };
if (import.meta.hot) import.meta.hot.accept('./mods.json', () => { if (!EDITOR.on) location.reload(); });

// wiring that runs once at start-up, before any other module draws or writes text
export function init(){
  setLabels(MODS.labels || {});
  if (Object.keys(MODS.labels || {}).length) hookText();
}
let hooked = false;
/** Rewords the page now, and routes its text and all canvas text through relabel from then on (init does it when there are labels). */
export function hookText(){
  if (hooked){ fixTree(document.body); return; }
  hooked = true;
  const P = CanvasRenderingContext2D.prototype, fill = P.fillText, stroke = P.strokeText, measure = P.measureText;
  P.fillText = function(t: string, x: number, y: number, w?: number){ return w === undefined ? fill.call(this, relabel(String(t)), x, y) : fill.call(this, relabel(String(t)), x, y, w); };
  P.strokeText = function(t: string, x: number, y: number, w?: number){ return w === undefined ? stroke.call(this, relabel(String(t)), x, y) : stroke.call(this, relabel(String(t)), x, y, w); };
  P.measureText = function(t: string){ return measure.call(this, relabel(String(t))); };
  document.title = relabel(document.title);
  fixTree(document.body);
  new MutationObserver(list => {
    for (const r of list){
      if (r.type === 'characterData') fixText(r.target as Text);
      else if (r.type === 'attributes') fixEl(r.target as Element);
      else r.addedNodes.forEach(fixTree);
    }
  }).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
}
