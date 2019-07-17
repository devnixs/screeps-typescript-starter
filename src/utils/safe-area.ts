import { SimplePos, findSafeAreaAround, findUnsafeArea } from "./finder";
import { profiler } from "./profiler";

const safeAreas: { [roomName: string]: SimplePos[] } = {};
const safeAreasLastCheckTime: { [roomName: string]: number } = {};

const unSafeAreas: { [roomName: string]: SimplePos[] } = {};
const unSafeAreasLastCheckTime: { [roomName: string]: number } = {};

let getSafeArea = function getSafeArea(room: Room) {
  const spawn = room.spawns[0];

  if (!spawn) {
    return null;
  }

  if (safeAreas[room.name]) {
    return safeAreas[room.name];
  }

  if (!safeAreasLastCheckTime[room.name] || safeAreasLastCheckTime[room.name] < Game.time - 10000) {
    console.log("Computing safe area...", room.name);
    const safeArea = findSafeAreaAround(spawn.pos, room);
    safeAreasLastCheckTime[room.name] = Game.time;
    if (safeArea) {
      console.log("Computation successful", room.name);
      safeAreas[room.name] = safeArea;
      return safeArea;
    }
  } else {
    console.log("Last check time is too soon", safeAreasLastCheckTime[room.name]);
  }
  return null;
};
let getUnSafeArea = function getUnSafeArea(room: Room) {
  const spawn = room.spawns[0];

  if (!spawn) {
    return null;
  }

  if (unSafeAreas[room.name]) {
    return unSafeAreas[room.name];
  }

  if (!unSafeAreasLastCheckTime[room.name] || unSafeAreasLastCheckTime[room.name] < Game.time - 10000) {
    console.log("Computing unsafe area...", room.name);
    const safeArea = findUnsafeArea(room);
    unSafeAreasLastCheckTime[room.name] = Game.time;
    if (safeArea) {
      console.log("Computation successful", room.name);
      unSafeAreas[room.name] = safeArea;
      return safeArea;
    }
  } else {
    console.log("Last check time is too soon", unSafeAreasLastCheckTime[room.name]);
  }
  return null;
};

let isInSafeArea = function isInSafeArea(pos: SimplePos, room: Room) {
  const safeArea = getSafeArea(room);
  if (!safeArea) {
    return undefined;
  }

  const result = safeArea.find(i => i.x === pos.x && i.y === pos.y);
  return !!result;
};

let isInUnSafeArea = function isInUnSafeArea(pos: SimplePos, room: Room) {
  const unsafeArea = getUnSafeArea(room);
  if (!unsafeArea) {
    return undefined;
  }

  const result = unsafeArea.find(i => i.x === pos.x && i.y === pos.y);
  return !!result;
};

let getSafeAreaBoundaries = function(room: Room) {
  const unsafeArea = getUnSafeArea(room);
  if (!unsafeArea) {
    return undefined;
  }

  const boundaries: SimplePos[] = [];

  for (let i = 0; i <= 49; i++) {
    for (let j = 0; j <= 49; j++) {
      const isInside = unsafeArea.find(s => s.x === i && s.y === j);
      if (!isInside) {
        continue;
      }

      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const neighboor = unsafeArea.find(s => {
            return s.x === a + i && s.y === b + j;
          });
          if (!neighboor) {
            boundaries.push({ x: i, y: j });
            continue;
          }
        }
      }
    }
  }

  return boundaries;
};

getSafeArea = profiler.registerFN(getSafeArea, "getSafeArea");
isInSafeArea = profiler.registerFN(isInSafeArea, "isInSafeArea");

(global as any).isInSafeArea = isInSafeArea;
(global as any).showSafeAreaBoundaries = function(room: Room) {
  const boundaries = getSafeAreaBoundaries(room);
  if (boundaries) {
    boundaries.forEach(b => {
      room.visual.circle(b.x, b.y, {
        radius: 0.4,
        opacity: 0.8,
        fill: "yellow",
        lineStyle: "solid"
      });
    });
  }
};
(global as any).showSafeArea = function(room: Room) {
  const boundaries = getSafeArea(room);
  if (boundaries) {
    boundaries.forEach(b => {
      room.visual.circle(b.x, b.y, {
        radius: 0.4,
        opacity: 0.8,
        fill: "red",
        lineStyle: "solid"
      });
    });
  }
};
(global as any).showUnSafeArea = function(room: Room) {
  const boundaries = getUnSafeArea(room);
  if (boundaries) {
    console.log("Found", boundaries.length);
    boundaries.forEach(b => {
      room.visual.circle(b.x, b.y, {
        radius: 0.4,
        opacity: 0.8,
        fill: "red",
        lineStyle: "solid"
      });
    });
  }
};
export { getSafeArea, isInSafeArea, getSafeAreaBoundaries, isInUnSafeArea };
