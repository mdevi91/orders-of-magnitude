import { sfx } from './audio';
import { GCOL, T, grpOf, isWeapon } from './catalog';
import { headOf } from './editor';
import { K, clamp } from './grid';
import { save } from './save';
import { G } from './state';
import { syncUI, toast } from './ui';
import type { Key } from './types';
import { $ } from './view';

// auto-aim: the keyboard/button choice is remembered; touch turns it on without saving
export function setAuto(v: boolean, save=true){
  G.aimAuto = v; if (save) try { localStorage.setItem('oom-auto', v ? '1' : '0'); } catch {}
  const b = $('aimBtn'); b.textContent = v ? 'Auto on' : 'Auto off'; b.setAttribute('aria-pressed', String(v));
}
// combat camera: the player's zoom multiplies the automatic framing and is remembered
export function camZoom(f: number){ G.camMul = clamp(G.camMul*f, .45, 3); try { localStorage.setItem('oom-cam', String(G.camMul)); } catch {} }
// weapon groups: the drydock assigns types to groups, and combat toggles each group's auto fire (keys 1-5)
export function toggleGroup(n: number){ G.auto[n-1] = !G.auto[n-1]; toast(`Group ${n}: ${G.auto[n-1] ? 'auto fire' : 'fires with you'}`); renderGroups(); save(); }
export const shipWeapons = () => [...G.design].filter(([k,t]) => isWeapon(t));
// the group brush: pick a group in the panel, then click or drag over weapons on the ship
export function setBrush(n: number){ G.grpBrush = n; syncUI(); }
export function assignAt(i: number, j: number, l: number){
  const [hi,hj,hl] = headOf(i,j,l), k = K(hi,hj,hl), t = G.design.get(k);
  if (!t || !isWeapon(t) || grpOf(k,t)===G.grpBrush) return;
  G.grp[k] = G.grpBrush; sfx('place'); save();
}
export function renderGroups(){
  const ws = shipWeapons(), on = (n: number) => G.auto[n-1], N = [1,2,3,4,5];
  // what each group holds, e.g. "2× Cannon, Missile"
  const inG = (n: number) => { const c = new Map<string, number>(); for (const [k,t] of ws) if (grpOf(k,t)===n) c.set(T[t].name, (c.get(T[t].name)||0) + 1); return [...c].map(([name,m]) => (m > 1 ? m+'× ' : '') + name); };
  const B = G.grpBrush;
  $('grps').innerHTML = ws.length ?
    `<p class="sub">${B ? `Click or drag over weapons on the ship to put them in <b>group ${B}</b>. The number on each weapon is its group.` : 'Pick a group number, then click weapons on the ship to put them in that group. Each weapon has its own group, so two cannons can be in different ones.'}</p>` +
    `<div class="gtab"><span class="gh">Assign</span>${N.map(n => `<button type="button" class="gb gk" data-b="${n}" aria-pressed="${B===n}" style="--gc:${GCOL[n-1]}" title="Put weapons in group ${n}">${n}</button>`).join('')}` +
    `<span class="gh">Fires</span>` + N.map(n => `<button type="button" class="gb ga" data-a="${n}" aria-pressed="${on(n)}" title="Group ${n} fires ${on(n) ? 'by itself' : 'with you'}">${on(n) ? 'Auto' : 'Man'}</button>`).join('') + '</div>' +
    N.map(n => { const l = inG(n); return l.length ? `<p class="gl"><b style="color:${GCOL[n-1]}">${n}</b> ${l.join(', ')}${on(n) ? ' · auto' : ''}</p>` : ''; }).join('') +
    (B ? '<button type="button" class="rot wide-btn" data-b="0">Done assigning</button>' : '')
    : '<p class="sub">Put a weapon on the ship to set up groups.</p>';
  const gs = N.map(n => {
    const l = inG(n); if (!l.length) return '';
    return `<button type="button" class="gb grpc" data-a="${n}" aria-pressed="${on(n)}"><kbd>${n}</kbd> ${l.join(', ')} · ${on(n) ? 'AUTO' : 'manual'}</button>`;
  }).join('');
  $('groups').innerHTML = gs ? '<span class="ghd">Weapon groups · keys 1-5 or click</span>' + gs : '';
}

// wiring that runs once at start-up
export function init(){
  $('aimBtn').addEventListener('click', () => setAuto(!G.aimAuto));
  try { G.camMul = clamp(Number(localStorage.getItem('oom-cam')) || 1, .45, 3); } catch {}
  $('zoomIn').addEventListener('click', () => camZoom(.8));
  $('zoomOut').addEventListener('click', () => camZoom(1.25));
}
