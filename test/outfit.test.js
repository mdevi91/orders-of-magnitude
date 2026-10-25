// A new run opens in the drydock for outfitting: any unlocked block can be bought onto the ship until the first launch.
fresh();
ok('run opens in the drydock', G.mode==='build' && G.outfit);
const cr = G.credits, price = outfitPrice('gatling');
ok('gatling is for sale', owned('gatling') && placeCheck(2,0,'gatling',0) === true, placeCheck(2,0,'gatling',0));
tryPlace(2,0,'gatling',0);
ok('buying spends the budget', G.design.get(K(2,0))==='gatling' && G.credits === cr - price, `${cr} -> ${G.credits}`);
ok('locked blocks are not for sale', !owned('bbay'));
let n = 0; for (let j=1; j<=40; j++) if (tryPlace(-1,j,'hull',0) === true) n++;
ok('no block limit', n === 40 || G.credits < T.hull.cost, `${n} hull placed`);
$('launch').click();
ok('launch ends outfitting', !G.outfit && G.mode==='map');
ok('nothing for sale after launch', placeCheck(3,0,'gatling',0) !== true);
