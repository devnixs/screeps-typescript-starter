import { profiler, profileMethod } from "../utils/profiler";

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

interface IRestPosition {
  X: number;
  Y: number;
  roomName: string;
}

let findRestSpot = function findRestSpot(creep: Creep) {
  const memory = (creep.memory as any) as { rest: IRestPosition };

  if (!memory.rest) {
    const specificRestFlag = Object.keys(Game.flags)
      .filter(i => i.indexOf(creep.memory.role + "_rest") === 0)
      .map(i => Game.flags[i])
      .filter(i => i && i.room && i.room.name === creep.room.name)[0];

    const restFlag =
      specificRestFlag ||
      Object.keys(Game.flags)
        .filter(i => i.indexOf("rest_") === 0)
        .map(i => Game.flags[i])
        .filter(i => i && i.room && i.room.name === creep.room.name)[0];

    if (restFlag) {
      memory.rest = { X: restFlag.pos.x, Y: restFlag.pos.y, roomName: creep.room.name };
    } else {
      const startPosition = { x: _.random(5, 44), y: _.random(5, 44) };
      const emptySpot = findEmptySpotCloseTo(startPosition, creep.room);
      if (emptySpot) {
        memory.rest = { X: emptySpot.x, Y: emptySpot.y, roomName: creep.room.name };
      }
    }
  }

  if (memory.rest) {
    return new RoomPosition(memory.rest.X, memory.rest.Y, memory.rest.roomName);
  } else {
    return null;
  }
};

interface SimplePos {
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
        if (Math.abs(i) + Math.abs(j) === 1 && possibleX >= 0 && possibleY >= 0 && possibleX < 50 && possibleY < 50) {
          if (!closedList.find(i => i.x === possibleX && i.y === possibleY)) {
            openList.push({ x: possibleX, y: possibleY });
          }
        }
      }
    }
  }
  return null;
};

findAndCache = profiler.registerFN(findAndCache, "findAndCache");
findNonEmptyResourceInStore = profiler.registerFN(findNonEmptyResourceInStore, "findNonEmptyResourceInStore");
findRestSpot = profiler.registerFN(findRestSpot, "findRestSpot");
findEmptySpotCloseTo = profiler.registerFN(findEmptySpotCloseTo, "findEmptySpotCloseTo");

export { findAndCache, findNonEmptyResourceInStore, findRestSpot, findEmptySpotCloseTo };
