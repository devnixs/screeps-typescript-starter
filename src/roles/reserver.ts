import { getUsername } from "utils/misc-utils";
import { findHostile } from "utils/finder";

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

      const enemy = findHostile(creep);
      if (enemy && enemy.pos.getRangeTo(creep.pos.x, creep.pos.y) < 10) {
        // flee
        creep.say("RUN!");
        creep.goTo(new RoomPosition(20, 20, memory.homeRoom));
        return;
      }

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
