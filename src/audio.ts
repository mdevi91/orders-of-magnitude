// @ts-nocheck
import { $ } from './view';

// ---------- sound: tiny WebAudio synth, no files ----------
export let AC = null, master = null, muted = false, noiseBuf = null;
export function audio(){
  if (!AC){
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = .22; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const ch = noiseBuf.getChannelData(0); for (let n=0; n<ch.length; n++) ch[n] = Math.random()*2 - 1;
    } catch { AC = null; return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
export function tone(type, f0, f1, dur, vol, at=0){
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.02);
}
export function noise(dur, vol, f0, f1=f0, at=0){
  const t = AC.currentTime + at, src = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40,f1), t+dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t+dur);
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t, Math.random()*.5); src.stop(t+dur+.02);
}
export const SFX = {
  shot:    v => tone('square', 900, 450, .05, .08*v),
  cannon:  v => { tone('square', 200, 70, .12, .16*v); noise(.08, .12*v, 1400, 300); },
  gatling: v => noise(.03, .07*v, 5000, 2000),
  missile: v => noise(.35, .1*v, 900, 200),
  laser:   v => tone('sawtooth', 1300, 1200, .07, .03*v),
  rail:    v => { tone('sawtooth', 2400, 90, .4, .16*v); noise(.25, .15*v, 6000, 500); },
  pd:      v => tone('square', 2200, 1600, .03, .04*v),
  eshot:   v => tone('triangle', 520, 300, .06, .05*v),
  hit:     v => tone('square', 260, 140, .04, .07*v),
  shield:  v => tone('sine', 1500, 2100, .07, .08*v),
  pop:     v => { tone('square', 900, 90, .35, .12*v); noise(.2, .08*v, 3000, 300); },
  boom:    v => { noise(.45*v + .15, .22*Math.min(1.5,v), 1800, 90); tone('sine', 90, 35, .3, .14*v); },
  big:     v => { noise(1.3, .4, 1200, 50); tone('sine', 70, 25, 1.1, .35); },
  ram:     v => noise(.09, .14*v, 2500, 400),
  launch:  v => { noise(.4, .1*v, 500, 3000); tone('square', 300, 900, .2, .04*v); },
  dock:    v => [880,660].forEach((f,n) => tone('square', f, f, .06, .05*v, n*.07)),
  lowEn:   v => tone('square', 180, 170, .09, .06*v),
  place:   v => tone('square', 700, 700, .025, .05*v),
  upgrade: v => [523,659,784].forEach((f,n) => tone('square', f, f, .09, .07, n*.07)),
  unlock:  v => [784,988,1175,1568].forEach((f,n) => tone('square', f, f, .1, .07, n*.08)),
  clear:   v => [523,659,784,1046].forEach((f,n) => tone('square', f, f*1.01, .16, .08, n*.12)),
  die:     v => { tone('sawtooth', 420, 40, 1.2, .2); noise(1.2, .3, 1500, 60); },
};
export const GAP = {gatling:.05, laser:.08, eshot:.07, hit:.04, shield:.05, boom:.05, lowEn:.7, place:.03, pd:.05, shot:.03};
export const lastSfx = {};
export function sfx(n, v=1){
  if (muted || !AC || AC.state !== 'running') return;
  const now = AC.currentTime; if (lastSfx[n] && now - lastSfx[n] < (GAP[n] ?? .02)) return;
  lastSfx[n] = now; try { SFX[n](v); } catch {}
}
export function setMute(m){ muted = m; try { localStorage.setItem('oom-mute', m ? '1' : '0'); } catch {} $('muteBtn').textContent = m ? '♪ off' : '♪ on'; }

// wiring that runs once at start-up
export function init(){
  try { muted = localStorage.getItem('oom-mute') === '1'; } catch {}
}
