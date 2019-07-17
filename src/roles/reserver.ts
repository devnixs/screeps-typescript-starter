import { getUsername, flee } from "utils/misc-utils";
import { findHostile } from "utils/finder";
import { signature } from "constants/misc";

export interface IReserverMemory extends CreepMemory {
  targetRoomName: string;
}

class RoleReserver implements IRole {
  run(creep: Creep) {
    const memory: IReserverMemory = creep.memory as any;

    if (flee(creep) === OK) {
      return;
    }

    if (creep.room.name !== memory.targetRoomName) {
      const targetRoom = Game.rooms[memory.targetRoomName];
      if (targetRoom && targetRoom.controller) {
        creep.goTo(targetRoom.controller);
      } else {
        creep.goTo(new RoomPosition(20, 20, memory.targetRoomName));
      }
    } else {
      var ctrl = creep.room.controller;

      if (ctrl) {
        const reserveResult = creep.reserveController(ctrl);
        if (reserveResult === ERR_NOT_IN_RANGE) {
          creep.goTo(ctrl);
        }
        if (Game.time % 1000 === 0) {
          // We're in range
          if (reserveResult === OK) {
            creep.signController(ctrl, signature);
          }
        }
      }
    }
  }
}

export const roleReserver = new RoleReserver();
