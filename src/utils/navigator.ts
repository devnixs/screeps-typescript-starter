import { defaultReusePath } from "../constants";

function hashCode(str: string) {
  // java String#hashCode
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function intToRGB(i: number) {
  var c = (i & 0x00ffffff).toString(16).toUpperCase();

  return "#00000".substring(0, 6 - c.length) + c;
}

function stringToColor(str: string) {
  return intToRGB(hashCode(str));
}

// assigns a function to Creep.prototype: creep.travelTo(destination)
Creep.prototype.goTo = function(destination: RoomPosition | { pos: RoomPosition }, options?: MoveToOpts) {
  const creep = this;

  if (!destination) {
    return ERR_INVALID_TARGET;
  }

  const target: RoomPosition = (destination as any).pos || destination;

  if (target.x === undefined || target.y === undefined || target.roomName === undefined) {
    return ERR_INVALID_TARGET;
  }

  if (creep.room.name !== target.roomName) {
    return creep.moveTo(target, {
      ignoreCreeps: true,
      reusePath: defaultReusePath,
      visualizePathStyle: { stroke: stringToColor(creep.memory.role) },
      ...options
    });
  } else {
    if (!creep.pos.inRangeTo(target.x, target.y, 6)) {
      // if we're far, ignore creeps
      return creep.moveTo(target, {
        ignoreCreeps: true,
        reusePath: defaultReusePath,
        visualizePathStyle: { stroke: stringToColor(creep.memory.role) },
        ...options
      });
    } else {
      return creep.moveTo(target, {
        ignoreCreeps: false,
        reusePath: defaultReusePath,
        visualizePathStyle: { stroke: stringToColor(creep.memory.role) },
        ...options
      });
    }
  }
};
