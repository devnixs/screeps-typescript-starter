import { defaultReusePath } from "../constants";

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
      visualizePathStyle: { stroke: "#ff0000" },
      ...options
    });
  } else {
    if (!creep.pos.inRangeTo(target.x, target.y, 3)) {
      // if we're far, ignore creeps
      return creep.moveTo(target, {
        ignoreCreeps: true,
        reusePath: defaultReusePath,
        visualizePathStyle: { stroke: "#ff0000" },
        ...options
      });
    } else {
      return creep.moveTo(target, {
        ignoreCreeps: false,
        reusePath: defaultReusePath,
        visualizePathStyle: { stroke: "#ff0000" },
        ...options
      });
    }
  }
};
