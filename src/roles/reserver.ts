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
        if (ctrl.pos.isNearTo(creep)) {
          let reserveResult: ScreepsReturnCode;
          if (ctrl.reservation && ctrl.reservation.username !== getUsername()) {
            reserveResult = creep.attackController(ctrl);
          } else {
            reserveResult = creep.reserveController(ctrl);
          }
          if (reserveResult !== OK) {
            console.log(creep.name, "reserve result", reserveResult);
          }

          if (Game.time % 1242 === 0) {
            // We're in range
            creep.signController(ctrl, signature);
          }
        } else {
          creep.goTo(ctrl);
        }
      }
    }
  }
}

export const roleReserver = new RoleReserver();
