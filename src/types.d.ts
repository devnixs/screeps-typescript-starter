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
  | "pickaboo"
  | "healer"
  | "claimer"
  | "miner"
  | "truck"
  | "versatile"
  | "attacker"
  | "pestcontrol"
  | "dismantler";

// memory extension samples
interface CreepMemory {
  role: roles;
  homeRoom: string;
  subRole?: string;
  _travel?: any;
  _trav?: any;
  lastPos: { x: number; y: number };
  noMovementTicksCount: number;
  boostable: boolean;
}

interface RoomMemory {
  avoid: any;
  damagedStructureId: string | null;
  enemyId: string | null;
  damagedCreepId: string | null;
  lastTowerRefreshTime: number | undefined;
  labGroups: LabGroup[];

  isBoostMode: boolean;

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
  labResult: LabMemory;
  labSource1: LabMemory;
  labSource2: LabMemory;
  remainingAmountToProduce: number;
}

interface LabMemory {
  id: string;
  state: "waiting-for-resource" | "needs-emptying" | "running" | "idle";
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
  attackSquad: string[] | undefined;
  lastBucketQuantity: number | undefined;
  lastBucketRefillTime: number | undefined;

  cpuUsages: number[];

  closestRooms: { [roomName: string]: string };

  observersIds?: string[];
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
  routeCallback?: (roomName: string) => number;
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
  goTo(destination: HasPos | RoomPosition, ops?: MoveToOpts): number;
}

// type StoreDefinitionWithoutEnergy = Partial<Record<_ResourceConstantSansEnergy, number>>;
