import { SimplePos, findSafeAreaAround } from "./finder";
import { profiler } from "./profiler";
import { base50decode, base50encode } from "./misc-utils";

const safeAreas: { [roomName: string]: SimplePos[] } = {};
const safeAreasLastCheckTime: { [roomName: string]: number } = {};

let getSafeArea = function getSafeArea(room: Room) {
  const spawn = room.spawns[0];

  if (!spawn) {
    return null;
  }

  if (safeAreas[room.name]) {
    return safeAreas[room.name];
  }

  if (room.memory.safeArea) {
    // deserialize
    safeAreas[room.name] = _.chunk(base50decode(room.memory.safeArea), 2).map(([x, y]) => ({ x, y }));
    return safeAreas[room.name];
  } else {
    if (!safeAreasLastCheckTime[room.name] || safeAreasLastCheckTime[room.name] < Game.time - 10000) {
      console.log("Computing safe area...", room.name);
      const safeArea = findSafeAreaAround(spawn.pos, room);
      safeAreasLastCheckTime[room.name] = Game.time;
      if (safeArea) {
        console.log("Computation successful", room.name);
        safeAreas[room.name] = safeArea;
        room.memory.safeArea = base50encode(_.flatten(safeArea.map(i => [i.x, i.y])));
        return safeArea;
      }
    } else {
      console.log("Last check time is too soon", safeAreasLastCheckTime[room.name]);
    }
  }
  return null;
};

let isInSafeArea = function isInSafeArea(pos: SimplePos, room: Room) {
  const cpu = Game.cpu.getUsed();
  const safeArea = getSafeArea(room);
  if (!safeArea) {
    return false;
  }

  const result = safeArea.find(i => i.x === pos.x && i.y === pos.y);

  const used = Game.cpu.getUsed() - cpu;
  console.log("Is in safe area, used", used, "CPU");
  return result;
};

getSafeArea = profiler.registerFN(getSafeArea, "getSafeArea");
isInSafeArea = profiler.registerFN(isInSafeArea, "isInSafeArea");
(global as any).isInSafeArea = isInSafeArea;
export { getSafeArea, isInSafeArea };
