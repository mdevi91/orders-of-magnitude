// Mods: a modded sprite replaces the game's drawing (and goes again when dropped), and modded wording replaces text,
// with filled-in slots, capitals and joined-on pieces.
const px = (g, x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 20, 20); return g; };
const solid = (col, box, w, h) => ({ box, pal: [col], px: Array.from({length: h}, () => '0'.repeat(w)) });

// a part: the modded picture sits where the cannon was, whatever the plating under it
setSprite('part/cannon/p', solid('#ff00ff', [-6, -6, 6, 6], 24, 24));
let g = canvas(); drawBlock(g, 'cannon', 0, 'p', 0, 0, -Math.PI/2, false, 1);
ok('modded part drawn', px(g, 20, 20).join() === '255,0,255,255', px(g, 20, 20));
setSprite('part/cannon/p', null);
g = canvas(); drawBlock(g, 'cannon', 0, 'p', 0, 0, -Math.PI/2, false, 1);
ok('dropped part falls back to the game drawing', px(g, 20, 20).join() !== '255,0,255,255', px(g, 20, 20));

// plating: a modded steel plate stands in for a paint scheme with none of its own; enemies keep theirs
setSprite('plate/hull/steel', solid('#00ff00', [-5, -5, 5, 5], 20, 20));
const was = G.paint; G.paint = 'navy';
g = canvas(); drawBlock(g, 'hull', 0, 'p', 0, 0, -Math.PI/2, false, 1);
ok('steel plate stands in for navy', px(g, 12, 12).join() === '0,255,0,255', px(g, 12, 12));
g = canvas(); drawBlock(g, 'hull', 0, 'e', 0, 0, -Math.PI/2, false, 1);
ok('enemy plate untouched', px(g, 12, 12).join() !== '0,255,0,255', px(g, 12, 12));
G.paint = was; setSprite('plate/hull/steel', null);

// encode and decode round-trip, transparency included
{
  const c = document.createElement('canvas'); c.width = 3; c.height = 2; const h = c.getContext('2d');
  h.fillStyle = '#123456'; h.fillRect(0, 0, 1, 1); h.fillStyle = 'rgba(255,0,0,.5)'; h.fillRect(2, 1, 1, 1);
  const s = encode(h.getImageData(0, 0, 3, 2), [0, 0, 3, 2]), back = decode(s).getContext('2d');
  ok('encode keeps pixels', px(back, 0, 0).join() === '18,52,86,255' && px(back, 1, 0)[3] === 0 && Math.abs(px(back, 2, 1)[3] - 128) < 3, JSON.stringify(s));
}

// labels
setLabels({ 'Victory': 'Triumph', '{0} hostiles': '{0} foes', 'Salvage {0}, bounty {1}.': 'Scrap {0} and reward {1}', '+ CR': ' credits' });
ok('exact text', relabel('Victory') === 'Triumph', relabel('Victory'));
ok('keeps spacing round it', relabel('  Victory ') === '  Triumph ', JSON.stringify(relabel('  Victory ')));
ok('capitals', relabel('VICTORY') === 'TRIUMPH', relabel('VICTORY'));
ok('slots', relabel('3 hostiles') === '3 foes', relabel('3 hostiles'));
ok('slots in capitals', relabel('2 HOSTILES') === '2 FOES', relabel('2 HOSTILES'));
ok('two slots', relabel('Salvage +6, bounty +4.') === 'Scrap +6 and reward +4', relabel('Salvage +6, bounty +4.'));
ok('slot text relabelled too', relabel('Salvage Victory, bounty 1.') === 'Scrap Triumph and reward 1', relabel('Salvage Victory, bounty 1.'));
ok('joined-on piece', relabel('171 CR') === '171 credits', relabel('171 CR'));
ok('other text untouched', relabel('Defeat') === 'Defeat');
setLabels({});
ok('no labels, no change', relabel('Victory') === 'Victory');

// page and canvas text go through the wording once hooked (hooking rewords what is already on the page at once)
setLabels({ 'Victory': 'Triumph' });
const d = document.createElement('div'); document.body.append(d); d.textContent = 'Victory';
hookText();
ok('page text reworded', d.textContent === 'Triumph', d.textContent);
const textPx = t => { const c = document.createElement('canvas'); c.width = 120; c.height = 20; const h = c.getContext('2d'); h.font = '14px monospace'; h.fillStyle = '#fff'; h.fillText(t, 2, 15); return c.toDataURL(); };
ok('canvas text reworded', textPx('Victory') === textPx('Triumph'));
d.remove(); setLabels({});

// an edit replaces the stock drawing whole: a modded cockpit cell is not hidden under the stock cockpit picture
{
  const c = document.createElement('canvas'); c.width = 60; c.height = 60; const g = c.getContext('2d');
  const blank = () => Array.from(g.getImageData(0, 0, 60, 60).data).every(v => v === 0);
  // set aside any cockpit edits saved in mods.json, so the stock picture shows first
  const kept = ['part/cockpit/p', 'part/core/p', 'cockpit/fighter/steel'].map(id => [id, MODS.sprites[id]]);
  for (const [id] of kept) setSprite(id, null);
  g.translate(30, 10); drawCockpit(g, 'fighter', () => true);
  ok('stock cockpit picture drawn', !blank());
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 60, 60); g.translate(30, 10);
  setSprite('part/cockpit/p', solid('#ff00ff', [-6, -6, 6, 6], 24, 24));
  drawCockpit(g, 'fighter', () => true);
  ok('modded cockpit cell wins over the stock picture', blank());
  setSprite('part/cockpit/p', null);
  for (const [id, sp] of kept) if (sp) setSprite(id, sp);
}
