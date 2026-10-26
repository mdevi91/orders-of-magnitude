import { T, lvOf } from './catalog';
import { startFight } from './fights';
import { rand } from './grid';
import { cargoTypes, chance, damageRandom, giveLoot, inc, lootText, takeCargo, upgradeRandom } from './loot';
import { save } from './save';
import { goOn } from './starmap';
import { G } from './state';
import { tut } from './tutorial';
import type { FightKind, MapNode } from './types';
import { showOverlay } from './ui';

// ---------- signals: random events ----------
// Each choice returns the outcome text, or {fight, text} to start a fight. A third element hides the choice when it returns false.
/** An outcome: text to show, or a fight to start with its opening line. */
type Outcome = string | {fight: FightKind; text: string};
type Choice = [label: string, run: () => Outcome, shown?: () => boolean];
export const EVENTS: {title: string; text: string; choices: Choice[]}[] = [
  {title:'Drifting cargo pod', text:'A sealed pod tumbles past, still beeping.', choices:[
    ['Tractor it in', () => chance(.75) ? 'It holds a spare part.' + lootText([giveLoot(1.3)]) : `It was rigged. <b>${damageRandom(2)}</b> blocks damaged.`],
    ['Leave it', () => 'You let it drift.']]},
  {title:'Minefield', text:'Old mines litter the jump lane.', choices:[
    ['Thread through slowly', () => chance(.5) ? `A mine clips the hull. <b>${damageRandom(1)}</b> block damaged.` : 'You slip through untouched.'],
    ['Blast a path', () => { const cr = inc(15 + 5*G.stage); G.credits += cr; return `The chain of blasts rattles the ship: <b>${damageRandom(3)}</b> blocks damaged, but the casings sell for <b class="gold">+${cr}</b> credits.`; }]]},
  {title:'Bounty hunter', text:'A hunter offers a cut of a bounty if you help bring down a warship.', choices:[
    ['Join the hunt', () => { G.bounty = inc(50 + 15*G.stage); return {fight:'elite', text:`The target turns on you. <b class="gold">${G.bounty}</b> credits if it goes down.`}; }],
    ['Decline', () => 'The hunter flies off alone.']]},
  {title:'Derelict starbase', text:'A dead station hangs in the dark, its docks still open.', choices:[
    ['Board it', () => chance(.6) ? 'Its stores are intact.' + lootText([giveLoot(1.8), giveLoot(1)]) : {fight:'ambush', text:'It was not empty. Its last defenders open fire.'}],
    ['Strip the hull', () => { const cr = inc(20 + 6*G.stage); G.credits += cr; return `<b class="gold">+${cr}</b> credits of scrap.`; }]]},
  {title:'Derelict freighter', text:'A freighter drifts dark, cargo bay open.', choices:[
    ['Board it', () => {
      if (chance(.4)) return `Booby-trapped. <b>${damageRandom(3)}</b> blocks damaged.`;
      const cr = inc(10 + 5*G.stage); G.credits += cr;
      return `The hold is full: <b class="gold">+${cr}</b> credits.` + lootText([giveLoot(1.3)]);
    }],
    ['Leave it', () => 'You leave it to drift.']]},
  {title:'Distress call', text:'A damaged transport begs for help.', choices:[
    ['Answer', () => {
      if (chance(.5)) return {fight:'ambush', text:'It was a trap. Pirates drop their disguise.'};
      const cr = inc(20 + 6*G.stage); G.credits += cr;
      return `The crew pays you <b class="gold">${cr}</b> credits and hands over a spare.` + lootText([giveLoot(1)]);
    }],
    ['Ignore it', () => 'You fly on.']]},
  {title:'Wandering trader', text:'A trader hails you with a cargo hold full of parts.', choices:[
    ['Swap one cargo block for two', () => {
      const ks = cargoTypes(), t = ks[(Math.random()*ks.length)|0]; takeCargo(t);
      return `You hand over a ${T[t].name.toLowerCase()}.` + lootText([giveLoot(1), giveLoot(1)]);
    }, () => cargoTypes().length > 0],
    ['Buy a sealed crate (45 cr)', () => { G.credits -= 45; return 'You crack the crate open.' + lootText([giveLoot(2.2)]); }, () => G.credits >= 45],
    ['Move on', () => 'You decline.']]},
  {title:'Asteroid field', text:'Rich ore, and a lot of loose rock.', choices:[
    ['Mine it', () => {
      const cr = inc(25 + 8*G.stage); G.credits += cr;
      const d = chance(.5) ? damageRandom(2) : 0;
      return `<b class="gold">+${cr}</b> credits of ore.` + (d ? ` Rocks damage <b>${d}</b> blocks.` : '');
    }],
    ['Go around', () => 'You go around.']]},
  {title:'Mad engineer', text:'A tinkerer offers to tune your ship.', choices:[
    ['Pay him (60 cr)', () => { G.credits -= 60; const t = upgradeRandom(); return t ? `Your ${T[t].name.toLowerCase()} blocks are now level ${lvOf(t)}.` : 'He finds nothing left to improve and keeps the money.'; }, () => G.credits >= 60],
    ['Let him try for free', () => {
      if (chance(.5)){ const t = upgradeRandom(); if (t) return `It works. Your ${T[t].name.toLowerCase()} blocks are now level ${lvOf(t)}.`; }
      return `Sparks fly. <b>${damageRandom(3)}</b> blocks damaged.`;
    }],
    ['Decline', () => 'You leave him to his tools.']]},
  {title:'Military beacon', text:'A navy relay, lightly guarded.', choices:[
    ['Hack it', () => {
      if (chance(.5)) return {fight:'elite', text:'The hack trips an alarm. A warship answers.'};
      const t = upgradeRandom(); return t ? `You pull their specs. Your ${T[t].name.toLowerCase()} blocks are now level ${lvOf(t)}.` : 'Nothing useful in the files.';
    }],
    ['Leave it', () => 'You leave it alone.']]},
  {title:'Refugee convoy', text:'Refugees ask for credits to buy fuel.', choices:[
    ['Give 30 cr', () => { G.credits -= 30; G.stats!.bonus = (G.stats!.bonus||0) + 3; return 'They thank you. Word of it spreads: <b class="gold">+3 data</b> at the end of the run.'; }, () => G.credits >= 30],
    ['Move on', () => 'You fly on.']]},
  {title:'Scrap cloud', text:'Wreckage from an old battle.', choices:[
    ['Collect', () => { const cr = inc(rand(15,30) + 4*G.stage); G.credits += cr; return `<b class="gold">+${cr}</b> credits of scrap.`; }]]},
  {title:'Smuggler', text:'A smuggler wants parts, and pays well.', choices:[
    ['Sell a cargo block at full price', () => {
      const ks = cargoTypes(), t = ks[(Math.random()*ks.length)|0], cr = T[t].cost; takeCargo(t); G.credits += cr;
      return `He takes a ${T[t].name.toLowerCase()} for <b class="gold">${cr}</b> credits.`;
    }, () => cargoTypes().length > 0],
    ['Refuse', () => 'He shrugs and leaves.']]},
  {title:'Ion storm', text:'A storm blocks the lane.', choices:[
    ['Push through', () => `Arcs hit the hull. <b>${damageRandom(2)}</b> blocks damaged.`],
    ['Wait it out (20 cr)', () => { G.credits -= 20; return 'You wait for the storm to pass.'; }, () => G.credits >= 20]]},
  {title:'Abandoned shipyard', text:'An empty yard with working tools.', choices:[
    ['Use the dock', () => { const c = G.broken.size; G.broken.clear(); return c ? `You fix <b>${c}</b> damaged blocks.` : 'Nothing to fix, but you find a spare.' + lootText([giveLoot(1)]); }]]},
  {title:'Pirate toll', text:'Pirates demand payment to pass.', choices:[
    ['Pay 40 cr', () => { G.credits -= 40; return 'They let you through.'; }, () => G.credits >= 40],
    ['Refuse', () => ({fight:'ambush', text:'They open fire.'})]]},
];
export function runEvent(n: MapNode){
  tut('signal');
  if (n.ev == null) n.ev = (Math.random()*EVENTS.length)|0;
  const E = EVENTS[n.ev];
  const acts = E.choices.filter(c => !c[2] || c[2]()).map(([label, fn]): [string, () => void] => [label, () => {
    n.used = true; const r = fn(); save();
    if (typeof r !== 'string') showOverlay(E.title, r.text, [['Fight', () => startFight(r.fight)]], false, {eye:'Signal · hostile', ac:'var(--foe)'});
    else showOverlay(E.title, r, [[G.pendingNode ? 'Continue' : 'Star map', goOn]], false, {eye:'Signal · resolved', ac:'var(--line)'});
  }]);
  showOverlay(E.title, E.text, acts, false, {eye:`Incoming signal · sector ${G.stage}`, ac:'var(--line)', list:true});
}
