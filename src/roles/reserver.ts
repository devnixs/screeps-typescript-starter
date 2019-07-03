import { getUsername } from "utils/misc-utils";

export interface IReserverMemory extends CreepMemory {
  targetRoomName: string;
}

class RoleReserver implements IRole {
  run(creep: Creep) {
    const memory: IReserverMemory = creep.memory as any;

    if (creep.room.name !== memory.targetRoomName) {
      creep.goTo(new RoomPosition(20, 20, memory.targetRoomName));
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
            creep.signController(ctrl, "(V) (°,,,,°) (V)");
          }
        }
      }
    }
  }
}

export const roleReserver = new RoleReserver();
