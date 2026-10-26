// Abandon run: from Options on the star map, from the pause menu in a fight, and from the map panel link
window.confirm = () => true;
const btn = label => [...$('ovActions').children].find(b => b.textContent === label);
fresh(); toMap(); showOptions(hideOverlay);
ok('Options offers Abandon run during a run', !!btn('Abandon run'));
btn('Abandon run')?.click();
ok('one click only arms it', !!G.stats && !!btn('Click again to abandon'));
btn('Click again to abandon')?.click();
ok('abandoning from Options ends the run and shows the report', !G.stats && $('ovTitle').textContent === 'Run abandoned', `${!!G.stats} ${$('ovTitle').textContent}`);
fresh(); startFight('fight'); togglePause();
btn('Abandon run')?.click(); btn('Click again to abandon')?.click();
ok('abandoning from the pause menu ends the run', !G.stats && $('ovTitle').textContent === 'Run abandoned' && !G.paused, `${!!G.stats} ${$('ovTitle').textContent} ${G.paused}`);
fresh(); toMap(); $('mapAbandon').click(); $('mapAbandon').click();
ok('the map panel link ends the run', !G.stats, `${!!G.stats}`);
// windows that are not full-screen layouts carry no screen marker
showOptions(hideOverlay);
ok('the Options window is not styled as a screen', !$('ovTitle').closest('.card').hasAttribute('data-screen'));
