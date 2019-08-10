import { getUsername, flee } from "utils/misc-utils";
import { findHostile } from "utils/finder";
import { signature } from "constants/misc";

export interface IDowngraderMemory extends CreepMemory {
  targetRoomName: string;
}

class RoleDowngrader implements IRole {
  run(creep: Creep) {
    const memory: IDowngraderMemory = creep.memory as any;

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
          let Downgraderesult: ScreepsReturnCode;
          if (ctrl.reservation && ctrl.reservation.username !== getUsername()) {
            Downgraderesult = creep.attackController(ctrl);
          } else {
            Downgraderesult = creep.reserveController(ctrl);
          }
          if (Downgraderesult !== OK) {
            console.log(creep.name, "reserve result", Downgraderesult);
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

export const roleDowngrader = new RoleDowngrader();
