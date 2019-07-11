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

export function getUsername(): string {
  for (let i in Game.rooms) {
    let room = Game.rooms[i];
    if (room.controller && room.controller.my) {
      return room.controller.owner.username;
    }
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
