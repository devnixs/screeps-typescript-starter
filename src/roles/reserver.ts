import { getUsername } from "utils/misc-utils";
import { findHostile } from "utils/finder";
import { signature } from "constants/misc";

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
        const homeRoom = Game.rooms[memory.homeRoom].find(FIND_MY_SPAWNS)[0];
        creep.goTo(homeRoom);
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
            creep.signController(ctrl, signature);
          }
        }
      }
    }
  }
}

export const roleReserver = new RoleReserver();
