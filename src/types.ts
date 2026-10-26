// Shared shapes for the whole game. Runtime data lives in the modules; this file only describes it.
import type { BLOCKS, CRAFT, CockpitId, ET, EW } from './catalog';
import type { NODE } from './starmap';

/** Grid key from K(i,j): one number per cell. */
export type Key = number;
/** Facing 0..7 in 45° steps clockwise from fore. */
export type Facing = number;
export type Team = 'p' | 'e' | 'a';

/** Every block the player can build, plus the palette's Remove tool and the body cells of multi-cell parts. */
export type BlockType = keyof typeof BLOCKS;
/** What an enemy hull is made of. */
export type EnemyCell = keyof typeof ET;
/** Anything a ship cell can hold. */
export type Cell = BlockType | EnemyCell;
export type EnemyGun = keyof typeof EW;
export type CraftKind = keyof typeof CRAFT;
export type NodeType = keyof typeof NODE;
/** What a fight was started for: a map beacon, or an ambush from an event or interception. */
export type FightKind = 'fight' | 'elite' | 'ambush' | 'gate' | 'boss' | 'station';

export type BulletKind = 'shot' | 'oval' | 'line' | 'pellet' | 'ion' | 'torp' | 'mine' | 'miss' | 'mirv' | 'flak' | 'plasma'
  | 'eoval' | 'egat' | 'eflak' | 'emiss' | 'snipe' | 'ring' | 'aim';

export interface GunDef {
  /** reach in world units at scale 1 */
  range?: number;
  cd: number; en?: number; spd: number; dmg: number; spread: number; r: number;
  /** turret swing either side of the facing, radians */
  arc?: number;
  fx?: BulletKind; homing?: boolean; mirv?: number; pellets?: number; fan?: number; ion?: boolean;
  life?: number; fuse?: number; blast?: number; lob?: boolean; nofall?: boolean;
  /** anti-craft: picks fighters and bombers first and does double damage to them */
  aa?: boolean;
  /** fires over the ship's own hull, so nothing on board blocks it */
  over?: boolean;
}
export interface BlockDef {
  /** make: the manufacturer, for weapons and hangars */
  name: string; make?: string; cost: number; desc?: string;
  /** unlock: the sector a run must reach for the block to join loot and shops; rar: rarity 0 (common) to 4 (legendary) */
  key?: string; unlock?: number; rar?: number; hp?: number; mass?: number; rot?: boolean; thrust?: number; torque?: number;
  gun?: GunDef;
  laser?: { dps: number; range: number; en: number };
  rail?: { cd: number; pool: number; en: number; range: number };
  tesla?: { cd: number; range: number; dmg: number; jumps: number; en: number };
  sh?: { hp: number; regen: number; delay: number; down: number; en: number };
  /** heavy: also shoots down cannon slugs */
  pd?: { cd: number; range: number; en: number; heavy?: boolean };
  en?: { regen?: number; cap?: number };
}
export interface EnemyGunDef {
  unlock: number; w: number; range: number; cd: number; spd: number; dmg: number; r: number; kind: BulletKind; spread?: number;
  burst?: number; gap?: number; fuse?: number; blast?: number; life?: number; aim?: number;
}
export interface PartDef { len: number; w?: number; cells?: [number, number][]; body: BlockType }
export interface CraftDef {
  design: [number, number, Cell][]; hp: number; spd: number; agi: number; turn: number; orbit: number; over: number; orbSpd: number;
  range: number; sortie: number; rearm: number; rebuild: number; sfx: string; gun: GunDef;
}

/** A shield bubble: one per shield block. */
export interface Bubble { hp: number; max: number; down: number; last: number; flash: number; /** bearing of the last hit, for the hexagon flash */ ha?: number }

/** A block on a live ship. */
export interface Block {
  t: Cell; i: number; j: number; o: Facing; hp: number; max: number;
  /** railgun: charging until chg (game time), aimed off its facing by off */
  chg?: number; off?: number;
  /** weapon cooldown */
  cd: number;
  /** time it was last hit, for the white flash */
  hit: number;
  bub?: Bubble;
  /** engines: lit this frame */
  firing?: boolean;
  /** beam weapons: nothing of our own in the way */
  lane?: boolean;
  /** hangar bays: time until the next launch */
  bt?: number;
  ally?: Ship | null;
  craft?: Ship;
  /** enemy weapons: jammed by an ion hit until this time */
  jam?: number;
  /** enemy gatlings: shots so far in the current burst */
  shots?: number;
  beam?: [number, number, number, number] | null;
}

export interface Engine { c: { t: Cell; i: number; j: number; o: Facing; firing?: boolean }; active: boolean; tx: number; ty: number; tau: number }
export interface Physics {
  mass: number; inertia: number; torque: number; coreT: number; jetCW: number; jetCCW: number;
  F: { px: number; nx: number; py: number; ny: number }; engines: Engine[];
}

export interface Ship {
  team: Team; x: number; y: number; vx: number; vy: number;
  /** heading, and its cosine and sine */
  a: number; c: number; sn: number;
  blocks: Map<Key, Block>; alive: boolean; hpMul: number; r: number;
  guns: Block[]; pds: Block[]; rails: Block[]; lasers: Block[]; shields: Block[]; bays: Block[]; epd: Block[]; teslas: Block[];
  // player
  ph: Physics; en: number; enMax: number; enRegen: number;
  /** angular velocity */
  w: number;
  // enemies
  boss: boolean; elite: boolean; flag: boolean; station: boolean; fodder: boolean; craft: boolean;
  /** blocks at spawn, for phases and the boss bar */
  n0: number; phaseN: number;
  /** enemy scale: bullet speed and reach */
  sc: number;
  fireMul: number; ft: number; phase: number; spin: number; orb: number; orbSpd: number; pref: number; vmax: number; turn: number; value: number;
  tgt: Ship | null; armed?: boolean; sights: [number, number, number][] | null; wob?: number;
  /** player: untouchable until this time (the corvette's roll) */
  ghost?: number;
  /** enemy: the local bearing (0 = +x, -PI/2 = nose) it turns toward its target, and when it next re-checks */
  bside?: number; bsT?: number; flT?: number; rbT?: number;
  // hangar craft (either side)
  kind: CraftKind | null; bay: Block | null; sortie: number; aimA: number; cd: number; pick: number;
  /** shared life pool: every block adds to it, damage to any block takes from it, and the ship explodes at 0 */
  life: number; lifeMax: number;
  /** arriving from a space jump: seconds left in the jump, and the direction it comes in from */
  warp?: number; warpA?: number;
}

export interface Bullet {
  x: number; y: number; vx: number; vy: number; sp: number; r: number; dmg: number; life: number; life0?: number; kind: BulletKind;
  dead?: boolean; fuse?: number; blast?: number; fall?: boolean; ion?: boolean; homing?: boolean; mirv?: number; aa?: boolean;
  /** missile exhaust trail as x,y pairs */
  tr?: number[] | null;
  /** what the player's missile homes on */
  target?: Ship | null;
  /** what an enemy missile homes on */
  tgt?: Ship;
}

export type Fx =
  | { k: 'deb'; x: number; y: number; vx: number; vy: number; a: number; va: number; life: number; max: number; col: string;
      /** the block it was, drawn tumbling; whether it pops in a small blast before it fades */ t?: Cell; team?: Team; pop?: boolean }
  | { k: 'spk'; x: number; y: number; vx: number; vy: number; life: number; max: number; col: string }
  | { k: 'smoke'; x: number; y: number; vx: number; vy: number; r: number; life: number; max: number }
  | { k: 'boom'; x: number; y: number; r: number; life: number; max: number; /** seconds before it goes off */ d?: number }
  | { k: 'ring'; x: number; y: number; r: number; life: number; max: number; col: string }
  | { k: 'star'; x: number; y: number; a: number; r: number; life: number; max: number }
  | { k: 'txt'; x: number; y: number; vy: number; text: string; life: number; max: number };

export interface Beam { x1: number; y1: number; x2: number; y2: number; life: number; max: number; kind?: 'rail' | 'tesla' | 'epd' }

/** One ship in a wave plan. */
export interface ShipSpec { n: number; guns: number; bays?: number; boss?: boolean; elite?: boolean; flag?: boolean; station?: boolean }
export type Wave = ShipSpec[];
export type WavePlan = Wave[] & { name?: string };

export interface ShopOffer { t: BlockType; n: number }
export interface MapNode {
  id: number; col: number; x: number; y: number; type: NodeType; links: number[];
  used?: boolean; offers?: ShopOffer[];
  /** which signal this beacon carries */
  ev?: number;
}
export interface StarMap { nodes: MapNode[]; cur: number; done: boolean; seen: number[] }
export interface RunStats { kills: number; nodes: number; elites: number; flags: number; sectors: number; bonus: number; won: boolean;
  /** for the after-action report: hit points dealt and taken, own blocks destroyed, seconds in combat, biggest ship (blocks),
   *  and the best sector before the run (to list what it unlocked). Optional: older saves lack them. */
  dealt?: number; taken?: number; lost?: number; secs?: number; peak?: number; best0?: number }
/** A starting ship from Engineering: cells, facings, weapon groups. */
export interface StartDesign { d: [Key, BlockType][]; o: [Key, Facing][]; g?: Record<Key, number>; c?: CockpitId; /** paint scheme id */ p?: string }
/** What outlives every run: data to spend, research levels, the furthest sector reached, the starting ship, and records. */
export interface Meta { data: number; lv: Record<string, number>; best?: number; start?: StartDesign;
  /** Engineering keeps one starting ship per cockpit */
  builds?: Partial<Record<CockpitId, StartDesign>>; runs?: number; wins?: number; earned?: number; kills?: number }
export interface Stick { id: number; x0: number; y0: number; x: number; y: number }
export interface Banner { text: string; sub: string; t: number; red?: boolean }
export type Mode = 'title' | 'map' | 'build' | 'combat' | 'clear' | 'dead';

export interface GameState {
  mode: Mode;
  // drydock view and tools
  bz: number; bpx: number; bpy: number; mir: number; sel: BlockType; rot: Facing; mirror: boolean;
  hover: { i: number; j: number } | null; drag: 'place' | 'sell' | null; dragR?: number; lastCell: string | null; grpBrush: number;
  // the run
  /** the cockpit variant this run flies with */
  cockpit: CockpitId;
  /** the player's paint scheme (an id in PAINTS) */
  paint: string;
  stage: number; credits: number; design: Map<Key, BlockType>; dirs: Map<Key, Facing>; lv: Partial<Record<BlockType, number>>;
  inv: Partial<Record<BlockType, number>>; dmg: Partial<Record<BlockType, number>>; grp: Record<Key, number>; auto: boolean[];
  broken: Set<Key>; lost: Set<Key>; fresh: Set<BlockType>;
  map: StarMap | null; node: MapNode | null; pendingNode: MapNode | null; shopNode: MapNode | null; mapHover: MapNode | null;
  stats: RunStats | null; meta: Meta; bounty: number;
  /** outfitting the starting ship: blocks can be bought straight from the palette until the first launch */
  outfit: boolean;
  pick: ((t: BlockType | null) => void) | null;
  // the fight
  fight: FightKind; ships: Ship[]; player: Ship | null; boss: Ship | null; pb: Bullet[]; eb: Bullet[]; fx: Fx[]; beams: Beam[];
  /** railgun slugs in flight: origin, direction, full length, distance flown, damage left to deal */
  slugs: {ox: number; oy: number; dx: number; dy: number; len: number; d: number; pool: number}[];
  waves: WavePlan; waveIdx: number; waveGap: number; time: number; S: number; SC: number; AW: number; AH: number;
  camX: number; camY: number; camOX: number; camOY: number; zoom: number; camMul: number;
  span: number; spanT: number; span0: number; spanAt: number; spanStage: number | null; fit: number; swarmT: number;
  paused: boolean; aimAuto: boolean; /** with Shift held, WASD moves in screen directions instead of along the ship */ shiftAbs: boolean; /** no screen shake and no impact frames */ calm: boolean; /** impact frame: seconds of inverted picture left */ impT: number;
  /** the cockpit ability: seconds of cooldown left, and a request from right-click or E waiting for the next update */
  abT: number; abReq: boolean;
  /** targeting mode (Q): the next click locks a hostile; the lock, and when it was taken */
  tgtMode: boolean; lock: Ship | null; lockT: number;
  /** Fire control runs until fireT; a Salvo lets missile launchers fire on their own until salvoT */
  fireT: number; salvoT: number;
  /** the Phantom's Cloak runs until cloakT: enemies hold fire at the player */
  cloakT: number; fireHeld: boolean; mouse: { x: number; y: number; has: boolean };
  joy: Stick | null; aimJoy: Stick | null;
  banner: Banner | null; deadT: number; earned: number; shake: number; aim: { x: number; y: number };
}
