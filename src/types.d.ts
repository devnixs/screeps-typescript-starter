// example declaration file - remove these and add your own custom typings

type roles =
  | "harvester"
  | "static-harvester"
  | "upgrader"
  | "builder"
  | "ranged"
  | "reparator"
  | "fighter"
  | "explorer"
  | "long-distance-harvester"
  | "long-distance-truck"
  | "remote-defender"
  | "remote-defender-helper"
  | "local-defender"
  | "pickaboo"
  | "healer"
  | "claimer"
  | "miner"
  | "truck"
  | "versatile"
  | "attacker"
  | "pestcontrol"
  | "reserver"
  | "scout"
  | "transport"
  | "poker"
  | "stealer"
  | "dismantler";

// memory extension samples
interface CreepMemory {
  flee: number;
  role: roles;
  homeRoom: string;
  subRole?: string;
  _travel?: any;
  _trav?: any;
  lastPos: { x: number; y: number };
  noMovementTicksCount: number;
  boostable: boolean;

  rest: any;

  r?: number; // templateRepeat
  s?: number; // Last rest time. This is used to compute if a creep is "swappable" which means someone wants to move at this creep location, it's ok to swap it with him
}

interface PlannedLocation {
  x: number;
  y: number;
  setupTime: number;
}
interface StealingStat {
  pos: SimplePosWithRoomName;
  cost: number;
  brought: number;
}

interface RoomMemory {
  stealingStats: StealingStat[];
  needsStealers: SimplePosWithRoomName[];
  poker: string;
  controllerContainer?: string;
  boostModeIsSetup: boolean;
  useNewRoomPlanner: any;
  walls: number[] | undefined;
  restSpot: { x: number; y: number } | undefined;
  upgraderRatio: number;
  upgraderType: "mobile" | "static" | "undefined";

  isUnderSiege: boolean;
  squareRoadsAreSetup: boolean;
  storagePlannedLocation: PlannedLocation | undefined;
  terminalPlannedLocation: PlannedLocation | undefined;
  avoid: any;
  damagedStructureId: string | null;
  enemyId: string | null;
  damagedCreepId: string | null;
  lastTowerRefreshTime: number | undefined;
  labGroups: LabGroup[];

  links: LinkMemory[];

  areColonyRoadsSetup: boolean | undefined;
  areSourcesRoadsSetup: boolean | undefined;
  areControllerRoadsSetup: boolean | undefined;
  areMineralRoadsSetup: boolean | undefined;
  areControllerLinksSetup: boolean | undefined;

  constructionsAreSetupAtLevel: number | undefined;
  rnd: number | undefined;

  nextCheckNeedsBuilder: number;

  trucksCount: number | null;

  remotes: RemoteRoomDefinition[];

  needsDefenders: DefenseDefinition[];

  lastProgress: number | undefined;
  lastProgressChecktime: number;

  boostMode: BoostMode | undefined;
  lastRemoteCheckCtrlLevel: number | undefined;
  roomPlanner: RoomPlannerData;

  needsAttackers: AttackerNeed | undefined;
}

interface AttackerNeed {
  boosted: boolean;
  count: number;
  partyId: number;
  parts: BodyPartConstant[];
}

interface AttackSetup {
  fromRoom: string;
  toRoom: string;
  lastUpdateDate: number;

  parties: AttackParty[];
}

interface AttackParty {
  currentPos?: SimplePosWithRoomName;
  targetPos?: SimplePosWithRoomName;
  failed: boolean;
  isApproxPath: boolean;
  id: number;
  creeps: AttackPartyCreep[];
  needs: BodyPartConstant[][];
  mineralsNeeded: MineralNeed[];
  status: "forming" | "moving" | "regrouping" | "attacking" | "complete" | "dead";
  retreat: boolean;
  boosted: boolean;
  count: number;
  rallyPoint?: { x: number; y: number; roomName: string };
  attackPath?: string;
  ttl: number;
  distance?: number;
  blocker?: string;
}

interface MineralNeed {
  mineral: ResourceConstant;
  requiredAmount: number;
}

interface AttackPartyCreep {
  name: string;
  x: number;
  y: number;
}

interface BoostMode {
  parts?: BodyPartConstant[];
  minerals?: MineralNeed[];
  reason: "siege" | "remote" | "attack";
}

interface RoomPlannerData {
  centerX: number;
  centerY: number;

  structures: StructurePlanning[];
  spIndex: number; // Sector Position Index
}

interface StructurePlanning {
  x: number;
  y: number;
  l: number | null; // minimum level
  type: BuildableStructureConstant;
}

interface DefenseDefinition {
  boosted?: boolean;
  threatLevel: number;
  room: string;
  mode: "local" | "remote";
}

interface RemoteRoomDefinition {
  ratio?: number;
  // stats
  retrievedEnergy?: number | undefined;
  spentEnergy?: number | undefined;

  wastedEnergy?: boolean;
  distance: number;
  energyGeneration: number;
  needsReservation: boolean | undefined;
  room: string;
  x: number;
  y: number;

  container: string | undefined;
  energy: number;

  disabled: boolean;
}

interface Vector {
  x: number;
  y: number;
}

interface LinkMemory {
  id: string;
  type: "input" | "input-output" | "output";
  state: "idle" | "needs-emptying" | "needs-refill";
  needsAmount?: number;
}

interface LabGroup {
  lastActivity: number | undefined;
  currentState: "idle" | "running";
  currentTarget: ResourceConstant | undefined;
  labResults: LabMemory[];
  labSource1: LabMemory;
  labSource2: LabMemory;
  remainingAmountToProduce: number;
}

type LabState = "waiting-for-resource" | "needs-emptying" | "running" | "idle";

interface LabMemory {
  id: string;
  state: LabState;
  needsResource: ResourceConstant;
  needsAmount: number;
  canRun: boolean;

  boostResource?: ResourceConstant;
  boostBodyType?: BodyPartConstant;
}

interface Memory {
  uuid: number;
  log: any;
  existingTowerIds: string[] | undefined;
  noNotificationBefore: number | undefined;
  lastBucketQuantity: number | undefined;
  lastBucketRefillTime: number | undefined;

  cpuUsages: number[];

  closestRooms: { [roomName: string]: string };

  // roomExplorations: RoomExplorationReport[];
  // explorations: RoomExplorationReport[];

  lastConquestTime: number | undefined;

  attack: AttackSetup | undefined;
}

type MEMORY_TICK = "t";

interface SimplePos {
  x: number;
  y: number;
}

interface SimplePosWithRoomName {
  x: number;
  y: number;
  roomName: string;
}

interface RoomExplorationReport {
  /**
   * Last Analyzed
   */
  t: number;
  /**
   * Last Scouted
   */
  l: number;
  /**
   * enemy base
   */
  eb: boolean;
  /**
   * enemy spawns locations
   */
  es: SimplePos[];
  /**
   * enemy room controller level
   */
  el?: number;
  /**
   * enemy remote
   */
  er: boolean;
  /**
   * room
   */
  r: string;
  /**
   * closestRoom
   */
  cr: string;

  /**
   * Colonizable
   */
  c?: ColonizationEvaluation | undefined | null;

  /**
   * Enemy remote container locations
   */
  erc: SimplePos[] | null;
}

interface ColonizationEvaluation {
  x: number; // ideal spawn location
  y: number; // ideal spawn location
  s: number; // score

  m?: string; // mineral

  c?: number; //sourceCount
  w?: number; // walls count at spawn location

  s1?: number | undefined; // distance between source1 and spawn
  s2?: number; // distance between source2 and spawn
  s3?: number | undefined; // distance between ctrl and spawn

  dd?: number; // distance to closest room
  dds?: number; // distance to closest room score
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}

// Traveler

type Coord = { x: number; y: number };
type HasPos = { pos: RoomPosition };
interface PathfinderReturn {
  path: RoomPosition[];
  ops: number;
  cost: number;
  incomplete: boolean;
}

interface TravelToReturnData {
  nextPos?: RoomPosition;
  pathfinderReturn?: PathfinderReturn;
  state?: TravelState;
  path?: string;
}

interface TravelToOptions {
  ignoreRoads?: boolean;
  ignoreCreeps?: boolean;
  ignoreStructures?: boolean;
  preferHighway?: boolean;
  highwayBias?: number;
  allowHostile?: boolean;
  allowSK?: boolean;
  range?: number;
  obstacles?: { pos: RoomPosition }[];
  roomCallback?: (roomName: string, matrix: CostMatrix) => CostMatrix | boolean;
  routeCallback?: (roomName: string) => number | undefined;
  returnData?: TravelToReturnData;
  restrictDistance?: number;
  useFindRoute?: boolean;
  maxOps?: number;
  movingTarget?: boolean;
  freshMatrix?: boolean;
  offRoad?: boolean;
  stuckValue?: number;
  maxRooms?: number;
  repath?: number;
  route?: { [roomName: string]: boolean };
  ensurePath?: boolean;

  disableCaching?: boolean;
  pushCreeps?: boolean;
}

interface TravelData {
  state: any[];
  path: string;
}

interface TravelState {
  stuckCount: number;
  lastCoord: Coord;
  destination: RoomPosition;
  cpu: number;
}

interface Creep {
  travelTo(destination: HasPos | RoomPosition, ops?: TravelToOptions): number;
  goTo(destination: HasPos | RoomPosition, ops?: TravelToOptions): number;
}

interface Room {
  _checkRoomCache(): void;

  spawns: StructureSpawn[];
  extensions: StructureExtension[];
  roads: StructureRoad[];
  walls: StructureWall[];
  ramparts: StructureRampart[];
  keeperLairs: StructureKeeperLair[];
  portals: StructurePortal[];
  links: StructureLink[];
  towers: StructureTower[];
  labs: StructureLab[];
  containers: StructureContainer[];
  powerBanks: StructurePowerBank[];

  observer: StructureObserver;
  powerSpawn: StructurePowerSpawn;
  extractor: StructureExtractor;
  nuker: StructureNuker;
}

// type StoreDefinitionWithoutEnergy = Partial<Record<_ResourceConstantSansEnergy, number>>;
