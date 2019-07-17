import { profiler, profileMethod } from "../utils/profiler";
import { Traveler } from "./Traveler";

interface RoomAndExpiration {
  expiration: number;
  room: string;
}
const closestRooms: { [target: string]: RoomAndExpiration } = {};

let findClosestRoom = function(targetRoom: string) {
  if (closestRooms[targetRoom] && closestRooms[targetRoom].expiration <= Game.time) {
    delete closestRooms[targetRoom];
  }

  if (closestRooms[targetRoom]) {
    return closestRooms[targetRoom].room;
  }

  var myRooms = _.uniq(Object.keys(Game.spawns).map(spwnName => Game.spawns[spwnName].room.name)).filter(
    i => i != targetRoom
  );
  const targetSpawn = Game.rooms[targetRoom].spawns[0]
    ? Game.rooms[targetRoom].spawns[0].pos
    : new RoomPosition(25, 25, targetRoom);

  var roomsAndDistances = myRooms.map(sourceRoom => {
    const sourceSpawn = Game.rooms[sourceRoom].spawns[0].pos;
    var distance = Traveler.findTravelPath(sourceSpawn, targetSpawn);
    if (distance.incomplete) {
      return {
        roomName: sourceRoom,
        distance: 1000000
      };
    } else {
      return {
        roomName: sourceRoom,
        distance: distance.path.length
      };
    }
  });

  var closest = _.sortBy(roomsAndDistances, i => i.distance);
  if (!closest.length) {
    return undefined;
  }

  closestRooms[targetRoom] = {
    expiration: Game.time + 1000,
    room: closest[0].roomName
  };

  return closest[0].roomName;
};

const caches: { [key: string]: CacheEntry } = {};

interface CacheEntry {
  expiration: number;
  id: string | null;
}

let findAndCache = function findAndCache<K extends FindConstant>(
  creep: Creep,
  cacheKey: string,
  findConstant: FindConstant,
  keepAliveCheck: (element: FindTypes[K]) => boolean,
  filter: FindPathOpts & FilterOptions<K> & { algorithm?: string },
  duration: number = 50
): FindTypes[K] | null {
  const key = creep.id + cacheKey;

  let entry = caches[key];
  if (!entry || Game.time > entry.expiration) {
    const value = creep.pos.findClosestByRange(findConstant as any, filter) as AnyStructure;
    entry = {
      id: value ? value.id : null,
      expiration: Game.time + duration
    };
    caches[key] = entry;
  }

  if (!entry.id) {
    return null;
  }
  let obj = Game.getObjectById(entry.id) as any;

  if (!obj) {
    return null;
  }

  const keepAlive = keepAliveCheck(obj);
  if (!keepAlive) {
    obj = creep.pos.findClosestByRange(findConstant as any, filter) as any;
    if (!obj) {
      return null;
    }
    entry.expiration = Game.time + duration;
    entry.id = obj.id;
  }

  return obj;
};

let findNonEmptyResourceInStore = function findNonEmptyResourceInStore(
  store: StoreDefinition
): ResourceConstant | undefined {
  return Object.keys(store).find(i => (store as any)[i] > 0) as any;
};

let findNonEmptyResourcesInStore = function findNonEmptyResourcesInStore(store: StoreDefinition): ResourceConstant[] {
  return Object.keys(store).filter(i => (store as any)[i] > 0) as any;
};

export function findHostile(creep: Creep) {
  const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
    filter: creep => {
      return !!creep.body.find(
        i => i.type === ATTACK || i.type === RANGED_ATTACK || i.type === WORK || i.type === HEAL
      );
    }
  });
  return hostile;
}

export function findHostiles(creep: Creep) {
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
    filter: creep => {
      return !!creep.body.find(
        i => i.type === ATTACK || i.type === RANGED_ATTACK || i.type === WORK || i.type === HEAL
      );
    }
  });
  return hostiles;
}

interface IRestPosition {
  X: number;
  Y: number;
  roomName: string;
}

let findRestSpot = function findRestSpot(creep: Creep, closeTo?: { x: number; y: number }) {
  if (creep.room.memory.restSpot) {
    return new RoomPosition(creep.room.memory.restSpot.x, creep.room.memory.restSpot.y, creep.room.name);
  } else {
    if (closeTo) {
      return new RoomPosition(closeTo.x, closeTo.y, creep.room.name);
    }
    return null;
  }
};

export interface SimplePos {
  x: number;
  y: number;
}

let findEmptySpotCloseTo = function findEmptySpotCloseTo(pos: SimplePos, room: Room, ignoreFirst: boolean = false) {
  const openList = [pos];
  const closedList = [];

  let current: SimplePos | undefined;
  while ((current = openList.shift())) {
    closedList.push(current);
    const structureHere = room
      .lookAt(current.x, current.y)
      .find(i => i.type === LOOK_STRUCTURES || (i.type === LOOK_TERRAIN && i.terrain === "wall"));

    if (!structureHere && (!ignoreFirst || current.x != pos.x || current.y != pos.y)) {
      return current;
    }

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const possibleX = current.x + i;
        const possibleY = current.y + j;
        if ((i !== 0 || j !== 0) && possibleX >= 1 && possibleY >= 1 && possibleX < 49 && possibleY < 49) {
          if (
            !closedList.find(i => i.x === possibleX && i.y === possibleY) &&
            !openList.find(i => i.x === possibleX && i.y === possibleY)
          ) {
            openList.push({ x: possibleX, y: possibleY });
          }
        }
      }
    }
  }
  return null;
};

let findUnsafeArea = function findUnsafeArea(room: Room) {
  const cpu = Game.cpu.getUsed();
  const openList = [];
  const closedList: SimplePos[] = [];
  const terrain = Game.map.getRoomTerrain(room.name);

  for (let i = 0; i <= 49; i++) {
    openList.push({ x: i, y: 0 });
    openList.push({ x: 0, y: i });
    openList.push({ x: 49, y: i });
    openList.push({ x: i, y: 49 });
  }

  let current: SimplePos | undefined;
  let counter: number = 0;
  while ((current = openList.shift())) {
    if (counter++ >= 50000) {
      console.log("Stopped findUnsafeAreaAround execution");
      return;
    }
    const structures = room.lookForAt(LOOK_STRUCTURES, current.x, current.y);
    const constructedWallHere = structures.find(
      i => i.structureType === "rampart" || i.structureType === "constructedWall"
    );
    const naturalWallHere = terrain.get(current.x, current.y) === TERRAIN_MASK_WALL;

    if (constructedWallHere) {
      continue;
    } else if (naturalWallHere) {
      continue;
    } else {
      closedList.push(current);
    }
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const possibleX: any = (current.x + i) as number;
        const possibleY: any = (current.y + j) as number;
        if (i !== 0 || j !== 0) {
          if (
            possibleX > 0 &&
            possibleX < 49 &&
            possibleY > 0 &&
            possibleY < 49 &&
            !closedList.find(i => i.x === possibleX && i.y === possibleY) &&
            !openList.find(i => i.x === possibleX && i.y === possibleY)
          ) {
            openList.push({ x: possibleX, y: possibleY });
          }
        }
      }
    }
  }
  if (closedList.length > 0) {
    let visual = new RoomVisual(room.name);
    for (let i = closedList.length - 1; i >= 0; i--) {
      visual.circle(closedList[i].x, closedList[i].y, { radius: 0.5, fill: "#ff7722", opacity: 0.9 });
    }
  }
  const used = Game.cpu.getUsed() - cpu;
  console.log("Used", used, "CPU");
  return closedList;
};

let findSafeAreaAround = function findSafeAreaAround(pos: SimplePos, room: Room) {
  const cpu = Game.cpu.getUsed();
  const openList = [pos];
  const closedList: SimplePos[] = [];
  const terrain = Game.map.getRoomTerrain(room.name);

  let current: SimplePos | undefined;
  let counter: number = 0;
  while ((current = openList.shift())) {
    if (counter++ >= 50000) {
      console.log("Stopped findSafeAreaAround execution");
      return;
    }
    const structures = room.lookForAt(LOOK_STRUCTURES, current.x, current.y);
    const constructedWallHere = structures.find(
      i => i.structureType === "rampart" || i.structureType === "constructedWall"
    );
    const spawnHere = structures.find(i => i.structureType == "spawn");
    const naturalWallHere = terrain.get(current.x, current.y) === TERRAIN_MASK_WALL;

    if (constructedWallHere) {
      closedList.push(current);
      if (!spawnHere) {
        // the first point usually is the spawn. we want to keep adding points
        continue;
      }
    } else if (naturalWallHere) {
      continue;
    } else {
      closedList.push(current);
    }

    if (current.x === 0 || current.x === 49 || current.y === 0 || current.y === 49) {
      // walls are not closed
      return null;
    }

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const possibleX = current.x + i;
        const possibleY = current.y + j;
        if (i !== 0 || j !== 0) {
          if (
            !closedList.find(i => i.x === possibleX && i.y === possibleY) &&
            !openList.find(i => i.x === possibleX && i.y === possibleY)
          ) {
            openList.push({ x: possibleX, y: possibleY });
          }
        }
      }
    }
  }
  if (closedList.length > 0) {
    let visual = new RoomVisual(room.name);
    for (let i = closedList.length - 1; i >= 0; i--) {
      visual.circle(closedList[i].x, closedList[i].y, { radius: 0.5, fill: "#ff7722", opacity: 0.9 });
    }
  }
  const used = Game.cpu.getUsed() - cpu;
  console.log("Used", used, "CPU");
  return closedList;
};

export function findEmptyRempart(target: _HasRoomPosition, creep: Creep) {
  // find closest empty rempart
  return target.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: r =>
      r.structureType === "rampart" &&
      r.pos.lookFor(LOOK_STRUCTURES).filter(i => i.structureType !== "road").length === 1 &&
      (r.pos.lookFor(LOOK_CREEPS).length === 0 || (r.pos.x === creep.pos.x && r.pos.y === creep.pos.y))
  });
}

findAndCache = profiler.registerFN(findAndCache, "findAndCache");
findNonEmptyResourceInStore = profiler.registerFN(findNonEmptyResourceInStore, "findNonEmptyResourceInStore");
findNonEmptyResourcesInStore = profiler.registerFN(findNonEmptyResourcesInStore, "findNonEmptyResourcesInStore");
findRestSpot = profiler.registerFN(findRestSpot, "findRestSpot");
findEmptySpotCloseTo = profiler.registerFN(findEmptySpotCloseTo, "findEmptySpotCloseTo");
findSafeAreaAround = profiler.registerFN(findSafeAreaAround, "findSafeAreaAround");
findUnsafeArea = profiler.registerFN(findUnsafeArea, "findUnsafeArea");

(global as any).findSafeAreaAround = findSafeAreaAround;
(global as any).closestRooms = closestRooms;

export {
  findNonEmptyResourceInStore,
  findNonEmptyResourcesInStore,
  findRestSpot,
  findEmptySpotCloseTo,
  findClosestRoom,
  findSafeAreaAround,
  findAndCache,
  findUnsafeArea
};
