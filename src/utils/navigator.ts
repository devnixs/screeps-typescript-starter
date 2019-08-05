import { defaultReusePath } from "../constants/misc";
import "./Traveler";
import { ErrorMapper } from "./ErrorMapper";

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
Creep.prototype.goTo = function(destination: RoomPosition | { pos: RoomPosition }, options?: TravelToOptions) {
  const creep = this;

  if (!destination) {
    return ERR_INVALID_TARGET;
  }

  const target: RoomPosition = (destination as any).pos || destination;

  if (target.x === undefined || target.y === undefined || target.roomName === undefined) {
    return ERR_INVALID_TARGET;
  }

  try {
    // let before = Game.cpu.getUsed();
    const ret = creep.travelTo(target, { preferHighway: false, ...options });
    // let diff = Game.cpu.getUsed() - before;
    /*
    if (
      this.name === "long-distance-truck23" ||
      this.name === "long-distance-truck22" ||
      this.name === "long-distance-truck21"
    ) {
      console.log(this.name, "CPU used=", diff);
    } */
    return ret;
  } catch (e) {
    console.log("Cannot move creep ", this.name, this.pos.roomName);
    console.log(e);
    return -1;
  }

  /*   let forceNoIgnoreCreeps = false;

  const currentPos = { x: this.pos.x, y: this.pos.y };
  if (currentPos.x === creep.memory.lastPos.x && currentPos.y === creep.memory.lastPos.y) {
    creep.memory.noMovementTicksCount++;
  } else {
    creep.memory.noMovementTicksCount = 0;
  }
  creep.memory.lastPos = currentPos;

  if (creep.memory.noMovementTicksCount > 5) {
    forceNoIgnoreCreeps = true;
  }

  if (creep.room.name !== target.roomName) {
    return creep.travelTo(target, {
      ignoreCreeps: true && !forceNoIgnoreCreeps,
      reusePath: forceNoIgnoreCreeps ? 0 : defaultReusePath,
      ...options
    });
  } else {
    if (!creep.pos.inRangeTo(target.x, target.y, 4)) {
      // if we're far, ignore creeps
      return creep.travelTo(target, {
        ignoreCreeps: true && !forceNoIgnoreCreeps,
        reusePath: forceNoIgnoreCreeps ? 0 : defaultReusePath,
        ...options
      });
    } else {
      return creep.travelTo(target, {
        ignoreCreeps: false,
        reusePath: forceNoIgnoreCreeps ? 0 : defaultReusePath,
        ...options
      });
    }
  } */
};
