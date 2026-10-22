// Shared shapes for the whole game. Runtime data lives in the modules; this file only describes it.
import type { Quaternion, Vector3 } from 'three';
import type { BLOCKS, CRAFT, ET, EW } from './catalog';
import type { NODE } from './starmap';

/** Grid key from K(i,j,l): one number per cell. */
export type Key = number;
/** Facing 0..5: fore, starboard, aft, port, up, down. */
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

export type BulletKind = 'shot' | 'oval' | 'line' | 'pellet' | 'ion' | 'torp' | 'mine' | 'miss' | 'mirv' | 'flak'
  | 'eoval' | 'egat' | 'eflak' | 'emiss' | 'snipe' | 'ring' | 'aim';

export interface GunDef {
  /** reach in world units at scale 1 */
  range?: number;
  cd: number; en?: number; spd: number; dmg: number; spread: number; r: number;
  /** turret swing either side of the facing, radians: a cone around it */
  arc?: number;
  fx?: BulletKind; homing?: boolean; mirv?: number; pellets?: number; fan?: number; ion?: boolean;
  life?: number; fuse?: number; blast?: number; lob?: boolean; nofall?: boolean;
}
export interface BlockDef {
  name: string; cost: number; desc?: string;
  key?: string; unlock?: number; hp?: number; mass?: number; rot?: boolean; thrust?: number; torque?: number;
  gun?: GunDef;
  laser?: { dps: number; range: number; en: number };
  rail?: { cd: number; pool: number; en: number; range: number };
  tesla?: { cd: number; range: number; dmg: number; jumps: number; en: number };
  sh?: { hp: number; regen: number; delay: number; down: number; en: number };
  pd?: { cd: number; range: number; en: number };
  en?: { regen?: number; cap?: number };
}
export interface EnemyGunDef {
  unlock: number; w: number; range: number; cd: number; spd: number; dmg: number; r: number; kind: BulletKind; spread?: number;
  burst?: number; gap?: number; fuse?: number; blast?: number; life?: number; aim?: number;
}
export interface PartDef { len: number; w?: number; body: BlockType }
export interface CraftDef {
  design: [number, number, Cell][]; hp: number; spd: number; agi: number; turn: number; orbit: number; over: number; orbSpd: number;
  range: number; sortie: number; rearm: number; rebuild: number; sfx: string; gun: GunDef;
}

/** A shield bubble: one per shield block. */
export interface Bubble { hp: number; max: number; down: number; last: number; flash: number }

/** A block on a live ship. */
export interface Block {
  t: Cell; i: number; j: number; l: number; o: Facing; hp: number; max: number;
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
  /** enemy gatlings: shots so far in the current burst */
  shots?: number;
  /** lasers: the beam this frame, start and end in world space */
  beam?: [Vector3, Vector3] | null;
  /** turrets: world direction the barrel points this frame */
  aim?: Vector3;
}

export interface Engine { c: { t: Cell; i: number; j: number; l: number; o: Facing; firing?: boolean }; active: boolean; dir: Vector3; thrust: number }
export interface Physics {
  mass: number; inertia: number; torque: number; coreT: number;
  /** engine thrust along each local axis: +x, -x, +y, -y, +z, -z */
  F: { px: number; nx: number; py: number; ny: number; pz: number; nz: number }; engines: Engine[];
}

export interface Ship {
  team: Team;
  /** position, velocity, orientation and angular velocity (ship-local axes) */
  p: Vector3; v: Vector3; q: Quaternion; w: Vector3;
  blocks: Map<Key, Block>; alive: boolean; hpMul: number; r: number;
  /** bumped whenever blocks are lost, so the renderer knows to rebuild the mesh */
  ver: number;
  guns: Block[]; pds: Block[]; rails: Block[]; lasers: Block[]; shields: Block[]; bays: Block[]; epd: Block[]; teslas: Block[];
  // player
  ph: Physics; en: number; enMax: number; enRegen: number;
  // enemies
  boss: boolean; elite: boolean; flag: boolean; station: boolean; fodder: boolean; craft: boolean;
  /** blocks at spawn, for phases and the boss bar */
  n0: number; phaseN: number;
  /** enemy scale: bullet speed and reach */
  sc: number;
  fireMul: number; ft: number; phase: number; spin: number; orb: number; orbSpd: number; pref: number; vmax: number; turn: number; value: number;
  /** the axis an enemy circles the player around */
  orbAxis: Vector3;
  tgt: Ship | null; armed?: boolean; sights: [Vector3, Vector3][] | null; jam?: number; wob?: number; flT?: number; rbT?: number;
  // hangar craft (either side)
  kind: CraftKind | null; bay: Block | null; sortie: number; cd: number; pick: number;
}

export interface Bullet {
  p: Vector3; v: Vector3; sp: number; r: number; dmg: number; life: number; life0?: number; kind: BulletKind;
  dead?: boolean; fuse?: number; blast?: number; fall?: boolean; ion?: boolean; homing?: boolean; mirv?: number;
  /** what the player's missile homes on */
  target?: Ship | null;
  /** what an enemy missile homes on */
  tgt?: Ship;
}

export type Fx =
  | { k: 'deb'; p: Vector3; v: Vector3; life: number; max: number; col: string; spin: Vector3 }
  | { k: 'spk'; p: Vector3; v: Vector3; life: number; max: number; col: string }
  | { k: 'smoke'; p: Vector3; v: Vector3; r: number; life: number; max: number }
  | { k: 'boom'; p: Vector3; r: number; life: number; max: number }
  | { k: 'ring'; p: Vector3; r: number; life: number; max: number; col: string }
  | { k: 'txt'; p: Vector3; vy: number; text: string; life: number; max: number };

export interface Beam { a: Vector3; b: Vector3; life: number; max: number; kind?: 'rail' | 'tesla' | 'epd' | 'pd' }

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
export interface RunStats { kills: number; nodes: number; elites: number; flags: number; sectors: number; bonus: number; won: boolean }
export interface Meta { data: number; lv: Record<string, number> }
export interface Stick { id: number; x0: number; y0: number; x: number; y: number }
export interface Banner { text: string; sub: string; t: number; red?: boolean }
export type Mode = 'title' | 'map' | 'build' | 'combat' | 'clear' | 'dead';
/** A cell under the drydock cursor, and the empty cell beside the face it was hit on. */
export interface BuildHover { i: number; j: number; l: number; ni: number; nj: number; nl: number }

export interface GameState {
  mode: Mode;
  // drydock view and tools
  bYaw: number; bPitch: number; bDist: number; mir: number; sel: BlockType; rot: Facing; mirror: boolean;
  hover: BuildHover | null; drag: 'place' | 'sell' | null; lastCell: string | null; grpBrush: number;
  // the run
  stage: number; credits: number; design: Map<Key, BlockType>; dirs: Map<Key, Facing>; lv: Partial<Record<BlockType, number>>;
  inv: Partial<Record<BlockType, number>>; dmg: Partial<Record<BlockType, number>>; grp: Record<Key, number>; auto: boolean[];
  broken: Set<Key>; lost: Set<Key>; fresh: Set<BlockType>;
  map: StarMap | null; node: MapNode | null; pendingNode: MapNode | null; shopNode: MapNode | null; mapHover: MapNode | null;
  stats: RunStats | null; meta: Meta; bounty: number;
  pick: ((t: BlockType | null) => void) | null;
  // the fight
  fight: FightKind; ships: Ship[]; player: Ship | null; boss: Ship | null; pb: Bullet[]; eb: Bullet[]; fx: Fx[]; beams: Beam[];
  waves: WavePlan; waveIdx: number; waveGap: number; time: number; S: number; SC: number;
  /** arena half-sizes: x, y (up) and z */
  AW: number; AH: number; AD: number;
  /** chase camera: distance multiplier the player sets, and the smoothed camera orientation */
  camMul: number; swarmT: number;
  paused: boolean; aimAuto: boolean; fireHeld: boolean; mouse: { x: number; y: number; has: boolean };
  joy: Stick | null; aimJoy: Stick | null;
  /** a fixed aim point (tests; touch aiming), overriding the mouse */
  aimAt: Vector3 | null;
  /** a world-space direction to move in (tests and bots), overriding the keys */
  moveWish: Vector3 | null;
  banner: Banner | null; deadT: number; earned: number; shake: number; aim: Vector3;
}
