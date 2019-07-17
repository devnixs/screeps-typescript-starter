import { profiler } from "./profiler";

const DIRECTIONS = {
  // [x, y] adders
  1: [0, -1],
  2: [1, -1],
  3: [1, 0],
  4: [1, 1],
  5: [0, 1],
  6: [-1, 1],
  7: [-1, 0],
  8: [-1, -1]
} as any;

let roomPosfromDirection = function(pos: RoomPosition, direction: number) {
  // returns a RoomPosition given a RoomPosition and a direction
  return new RoomPosition(pos.x + DIRECTIONS[direction][0], pos.y + DIRECTIONS[direction][1], pos.roomName);
};

let getOffExit = function(creep: Creep) {
  let directionsFromExit = {
    // Legal directions from a given exit
    x: {
      49: [7, 8, 6],
      0: [3, 4, 2]
    },
    y: {
      49: [1, 8, 2],
      0: [5, 6, 4]
    }
  } as any;

  if (directionsFromExit["x"][creep.pos.x]) {
    // Are we on the left / right exits?
    var allowedDirections = directionsFromExit.x[creep.pos.x];
  } else if (directionsFromExit["y"][creep.pos.y]) {
    // or are we on the top / bottom exits?
    var allowedDirections = directionsFromExit.y[creep.pos.y];
  }

  if (!allowedDirections) {
    // Not on an exit tile
    // console.log(creep.name + " isnt on an exit tile");
    return false;
  }

  for (let direction of allowedDirections) {
    let stuff = roomPosfromDirection(creep.pos, direction).look(); // collection of things at our potential target
    if (
      _.findIndex(
        stuff,
        (p: any) =>
          p.type == "creep" || (p.structure && OBSTACLE_OBJECT_TYPES[p.structure.structureType]) || p.terrain == "wall"
      ) == -1
    ) {
      // longhand for 'is there an obstacle there?'
      creep.move(direction);
      return OK;
    }
  }

  return -1;
};

getOffExit = getOffExit = profiler.registerFN(getOffExit, "getOffExit");

export { getOffExit };
