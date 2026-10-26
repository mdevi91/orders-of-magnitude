// Options: Esc opens it outside a fight, its toggles flip and stick, Back returns; in a fight it sits behind the pause menu.
fresh(); showTitle();
const esc = () => dispatchEvent(new KeyboardEvent('keydown', {code:'Escape', key:'Escape'}));
esc();
ok('Esc on the main menu opens Options', optionsOpen());
const btn = id => document.querySelector(`#ovText button[data-act="opt:${id}"]`);
const was = G.shiftAbs; btn('shift').click();
ok('Shift steering flips and is saved', G.shiftAbs === !was && localStorage.getItem('oom-shiftabs') === (G.shiftAbs ? '1' : '0'));
ok('the row shows the new value', btn('shift').textContent === (G.shiftAbs ? 'Screen' : 'Ship'));
btn('shake').click();
ok('screen shake can be switched off', G.calm === true);
esc();
ok('Esc closes Options', $('overlay').hidden);
startFight('fight');
esc();
ok('Esc in a fight pauses', G.paused && !optionsOpen());
[...$('ovActions').children].find(b => b.textContent === 'Options').click();
ok('the pause menu opens Options', optionsOpen());
esc();
ok('Esc goes back to the pause menu', G.paused && $('ovTitle').textContent === 'Paused');
// test mode (shown with ?test in the address): jump straight to a later sector, unlock everything
G.paused = false; G.mode = 'title'; hideOverlay();
flipOption('t-unlock');
ok('test mode unlocks everything', G.meta.best === LAST_SECTOR && cpUnlocked('battle'));
flipOption('t-s6');
ok('test mode starts a run in sector 6', G.stage === 6 && G.stats && G.mode === 'map', `stage ${G.stage}, mode ${G.mode}`);
