import { findHostile, findHostiles } from "./finder";

// Random utilities that don't belong anywhere else

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function base50encode(arr: number[]) {
  if (!arr) {
    return arr;
  }
  return arr.map(i => chars.charAt(i)).join("");
}
export function base50decode(str: string) {
  return str.split("").map(i => chars.indexOf(i));
}

export function getFirstValueOfObject(obj: any) {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return undefined;
  } else {
    return obj[keys[0]];
  }
}

export function printRoomName(roomName: string): string {
  return '<a href="#!/room/' + Game.shard.name + "/" + roomName + '">' + roomName + "</a>";
}

export function color(str: string, color: string): string {
  return `<font color='${color}'>${str}</font>`;
}

export function roundTo(n: number, v: number) {
  return n - (n % v);
}

// Correct generalization of the modulo operator to negative numbers
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function minMax(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}

export function hasMinerals(store: { [resourceType: string]: number }): boolean {
  for (let resourceType in store) {
    if (resourceType != RESOURCE_ENERGY && (store[<ResourceConstant>resourceType] || 0) > 0) {
      return true;
    }
  }
  return false;
}

let username: string | undefined = undefined;
export function getUsername(): string {
  if (username) {
    return username;
  }
  try {
    for (let i in Game.rooms) {
      let room = Game.rooms[i];
      if (room.controller && room.controller.my) {
        username = room.controller.owner.username;
        return username;
      }
    }
  } catch (e) {
    console.error(e);
  }
  console.log("ERROR: Could not determine username. You can set this manually in src/settings/settings_user");
  return "ERROR: Could not determine username.";
}

export function onPublicServer(): boolean {
  return Game.shard.name.includes("shard");
}

interface toColumnsOpts {
  padChar: string;
  justify: boolean;
}

/* Merges a list of store-like objects, summing overlapping keys. Useful for calculating assets from multiple sources */
export function mergeSum(objects: { [key: string]: number | undefined }[]): { [key: string]: number } {
  let ret: { [key: string]: number } = {};
  for (let object of objects) {
    for (let key in object) {
      let amount = object[key] || 0;
      if (!ret[key]) {
        ret[key] = 0;
      }
      ret[key] += amount;
    }
  }
  return ret;
}

export function coordName(coord: Coord): string {
  return coord.x + ":" + coord.y;
}

export function derefCoords(coordName: string, roomName: string): RoomPosition {
  let [x, y] = coordName.split(":");
  return new RoomPosition(parseInt(x, 10), parseInt(y, 10), roomName);
}

export function averageBy<T>(objects: T[], iteratee: (obj: T) => number): number | undefined {
  if (objects.length == 0) {
    return undefined;
  } else {
    return _.sum(objects, obj => iteratee(obj)) / objects.length;
  }
}

export function minBy<T>(objects: T[], iteratee: (obj: T) => number | false): T | undefined {
  let minObj: T | undefined = undefined;
  let minVal = Infinity;
  let val: number | false;
  for (let i in objects) {
    val = iteratee(objects[i]);
    if (val !== false && val < minVal) {
      minVal = val;
      minObj = objects[i];
    }
  }
  return minObj;
}

export function maxBy<T>(objects: T[], iteratee: (obj: T) => number | false): T | undefined {
  let maxObj: T | undefined = undefined;
  let maxVal = -Infinity;
  let val: number | false;
  for (let i in objects) {
    val = iteratee(objects[i]);
    if (val !== false && val > maxVal) {
      maxVal = val;
      maxObj = objects[i];
    }
  }
  return maxObj;
}

export function logHeapStats(): void {
  if (typeof Game.cpu.getHeapStatistics === "function") {
    let heapStats = Game.cpu.getHeapStatistics();
    let heapPercent = Math.round(
      (100 * (heapStats.total_heap_size + heapStats.externally_allocated_size)) / heapStats.heap_size_limit
    );
    let heapSize = Math.round(heapStats.total_heap_size / 1048576);
    let externalHeapSize = Math.round(heapStats.externally_allocated_size / 1048576);
    let heapLimit = Math.round(heapStats.heap_size_limit / 1048576);
    console.log(`Heap usage: ${heapSize} MB + ${externalHeapSize} MB of ${heapLimit} MB (${heapPercent}%).`);
  }
}

export function isIVM(): boolean {
  return typeof Game.cpu.getHeapStatistics === "function";
}

export function getCacheExpiration(timeout: number, offset = 5): number {
  return Game.time + timeout + Math.round(Math.random() * offset * 2 - offset);
}

const hexChars = "0123456789abcdef";

export function randomHex(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return result;
}

export function exponentialMovingAverage(current: number, avg: number | undefined, window: number): number {
  return (current + (avg || 0) * (window - 1)) / window;
}

// Compute an exponential moving average for unevenly spaced samples
export function irregularExponentialMovingAverage(current: number, avg: number, dt: number, window: number): number {
  return (current * dt + avg * (window - dt)) / window;
}

// Create a shallow copy of a 2D array
export function clone2DArray<T>(a: T[][]): T[][] {
  return _.map(a, e => e.slice());
}

// Rotate a square matrix in place clockwise by 90 degrees
function rotateMatrix<T>(matrix: T[][]): void {
  // reverse the rows
  matrix.reverse();
  // swap the symmetric elements
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < i; j++) {
      let temp = matrix[i][j];
      matrix[i][j] = matrix[j][i];
      matrix[j][i] = temp;
    }
  }
}

// Return a copy of a 2D array rotated by specified number of clockwise 90 turns
export function rotatedMatrix<T>(matrix: T[][], clockwiseTurns: 0 | 1 | 2 | 3): T[][] {
  let mat = clone2DArray(matrix);
  for (let i = 0; i < clockwiseTurns; i++) {
    rotateMatrix(mat);
  }
  return mat;
}

export function getMyRooms() {
  return Object.keys(Game.rooms)
    .map(i => Game.rooms[i])
    .filter(i => i.controller && i.controller.my)
    .map(i => Game.rooms[i.name]);
}

export function paddingLeft(paddingValue: string, str: string | number) {
  str = str.toString();
  return String(paddingValue + str).slice(-paddingValue.length);
}

export function flee(creep: Creep) {
  let fleeing = false;
  fleeing = fleeing || creep.memory.flee ? creep.memory.flee > Game.time - 10 : false;
  if (!fleeing) {
    const enemy = findHostile(creep);
    fleeing = enemy ? enemy.pos.getRangeTo(creep.pos.x, creep.pos.y) < 10 : false;
    if (fleeing) {
      creep.memory.flee = Game.time;
    }
  }
  if (fleeing) {
    // flee
    creep.say("RUN!");
    const homeRoom = Game.rooms[creep.memory.homeRoom].controller;

    if (homeRoom) {
      // avoid area around hostiles
      const enemies = findHostiles(creep);

      const positions: HasPos[] = [];
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          enemies.forEach(enemy => {
            const x = enemy.pos.x + i;
            const y = enemy.pos.y + j;
            if (x >= 1 && x <= 49 && y >= 1 && y < 49) {
              positions.push({ pos: new RoomPosition(x, y, enemy.room.name) });
            }
          });
        }
      }

      creep.goTo(homeRoom, { stuckValue: 1, obstacles: positions });
    }
    return OK;
  } else {
    return -1;
  }
}

export function runFromTimeToTime(duration: number, every: number) {
  return Math.floor((Game.time / duration) % Math.floor(every / duration)) === 0;
}

export function getObstaclesToAvoidRangedEnemies(creep: Creep) {
  // avoid area around hostiles
  const enemies = findHostiles(creep);

  const positions: HasPos[] = [];
  enemies.forEach(enemy => {
    let range = 1;
    if (enemy.getActiveBodyparts(RANGED_ATTACK)) {
      range = 3;
    }

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        const x = enemy.pos.x + i;
        const y = enemy.pos.y + j;
        if (x >= 1 && x <= 49 && y >= 1 && y < 49) {
          positions.push({ pos: new RoomPosition(x, y, enemy.room.name) });
        }
      }
    }
  });

  return positions;
}

export function repeatArray<T>(array: T[], times: number) {
  // returns an array with element elem repeated n times.
  var arr: T[] = [];

  for (var i = 0; i < times; i++) {
    arr = arr.concat(array);
  }

  return arr;
}

export function hasRoomBeenAttacked(room: Room) {
  return room.controller && room.controller.safeModeAvailable < room.controller.level - 1;
}

export function sing(creep: Creep, words: string[]) {
  var word = words[Game.time % words.length];
  creep.say(word, true);
}
