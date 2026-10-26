// cockpit cells can't be removed or built over, by any build path
fresh(); G.meta.best = 12; enterEngineering(); switchCockpit('carrier');
const cells = () => [...G.design.values()].filter(t => t==='cockpit').length;
ok('the carrier deck has its three extra cells', cells() === 3);
select('sell'); buildAction(0, 1, 'sell'); buildAction(0, -1, 'place'); buildAction(0, 2, 'sell', true);
ok('Remove leaves them alone', cells() === 3, cells());
select('hull'); buildAction(0, 1, 'place'); buildAction(0, 2, 'place', true);
ok('plating cannot be built over them', cells() === 3 && G.design.get(K(0,1)) === 'cockpit', cells());
G.mir = 1; select('sell'); buildAction(0, 2, 'sell');
ok('mirror mode leaves them alone too', cells() === 3, cells());
// loading a blueprint keeps the cockpit's cells
bpSave(0); bpLoad(0);
ok('loading a blueprint keeps them', cells() === 3, cells());
