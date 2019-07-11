import { profiler, profileMethod } from "../utils/profiler";
import { close } from "inspector";

let findClosestRoom = function(targetRoom: string) {
  Memory.closestRooms = Memory.closestRooms || {};
  if (Memory.closestRooms[targetRoom]) {
    return Memory.closestRooms[targetRoom];
  }

  var myRooms = _.uniq(Object.keys(Game.spawns).map(spwnName => Game.spawns[spwnName].room.name)).filter(
    i => i != targetRoom
  );

  var roomsAndDistances = myRooms.map(sourceRoom => {
    var distance = Game.map.findRoute(sourceRoom, targetRoom);
    if (distance === -2) {
      return {
        roomName: sourceRoom,
        distance: 100000
      };
    } else {
      return {
        roomName: sourceRoom,
        distance: distance.length
      };
    }
  });

  var closest = _.sortBy(roomsAndDistances, i => i.distance);
  if (!closest.length) {
    return undefined;
  }

  Memory.closestRooms[targetRoom] = closest[0].roomName;

  return closest[0].roomName;
};

let findAndCache = function findAndCache<K extends FindConstant>(
  creep: Creep,
  cacheKey: string,
  findConstant: FindConstant,
  keepAliveCheck: (element: FindTypes[K]) => boolean,
  filter: FindPathOpts & FilterOptions<K> & { algorithm?: string },
  duration: number = 50
): FindTypes[K] | null {
  const memory = creep.memory as any;

  const expirationTimeout = duration; // ticks

  let cachedElementKey: string | null = memory[cacheKey];
  let cachedElement: FindTypes[K] | null = cachedElementKey ? Game.getObjectById(cachedElementKey) : null;

  const expiration = memory[cacheKey + "_expiration"];

  const hasExpired = cachedElement && expiration && Game.time > expiration;

  if (cachedElement && (hasExpired || !keepAliveCheck(cachedElement))) {
    memory[cacheKey] = null;
    cachedElement = null;
    cachedElementKey = null;
  }

  const searchForElementAfterKey = "searchForElementAfter" + cacheKey;

  if (!cachedElement && (!memory[searchForElementAfterKey] || memory[searchForElementAfterKey] <= Game.time)) {
    const foundElement: any = creep.pos.findClosestByPath(findConstant, filter);
    if (foundElement) {
      memory[cacheKey] = foundElement.id;
      memory[cacheKey + "_expiration"] = Game.time + expirationTimeout;
      cachedElement = foundElement;
    } else {
      memory[searchForElementAfterKey] = Game.time + 10;
    }
  }

  return cachedElement;
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

let findEmptySpotCloseTo = function findEmptySpotCloseTo(pos: SimplePos, room: Room) {
  const openList = [pos];
  const closedList = [];

  let current: SimplePos | undefined;
  while ((current = openList.shift())) {
    closedList.push(current);
    const structureHere = room
      .lookAt(current.x, current.y)
      .find(i => i.type === LOOK_STRUCTURES || (i.type === LOOK_TERRAIN && i.terrain === "wall"));

    if (!structureHere) {
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

findAndCache = profiler.registerFN(findAndCache, "findAndCache");
findNonEmptyResourceInStore = profiler.registerFN(findNonEmptyResourceInStore, "findNonEmptyResourceInStore");
findNonEmptyResourcesInStore = profiler.registerFN(findNonEmptyResourcesInStore, "findNonEmptyResourcesInStore");
findRestSpot = profiler.registerFN(findRestSpot, "findRestSpot");
findEmptySpotCloseTo = profiler.registerFN(findEmptySpotCloseTo, "findEmptySpotCloseTo");
findSafeAreaAround = profiler.registerFN(findSafeAreaAround, "findSafeAreaAround");

(global as any).findSafeAreaAround = findSafeAreaAround;

export {
  findAndCache,
  findNonEmptyResourceInStore,
  findNonEmptyResourcesInStore,
  findRestSpot,
  findEmptySpotCloseTo,
  findClosestRoom,
  findSafeAreaAround
};
