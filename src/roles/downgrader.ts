import { getUsername, flee } from "utils/misc-utils";
import { findHostile } from "utils/finder";
import { signature } from "constants/misc";
import { Cartographer } from "utils/cartographer";

export interface IDowngraderMemory extends CreepMemory {
  targetRoomName: string;
}

const roomCallback = (roomName: string, matrix: CostMatrix) => {
  if (Cartographer.roomType(roomName) === "SK") {
    return false;
  }

  return matrix;
};

class RoleDowngrader implements IRole {
  run(creep: Creep) {
    const memory: IDowngraderMemory = creep.memory as any;

    if (creep.room.name !== memory.targetRoomName) {
      const targetRoom = Game.rooms[memory.targetRoomName];
      if (targetRoom && targetRoom.controller) {
        creep.goTo(targetRoom.controller, {
          allowSK: false,
          roomCallback: roomCallback
        });
      } else {
        creep.goTo(new RoomPosition(20, 20, memory.targetRoomName), { allowSK: false, roomCallback: roomCallback });
      }
    } else {
      var ctrl = creep.room.controller;

      if (ctrl) {
        if (ctrl.pos.isNearTo(creep)) {
          let downgraderesult: ScreepsReturnCode;
          downgraderesult = creep.attackController(ctrl);
          if (downgraderesult !== OK) {
            // console.log(creep.name, "reserve result", Downgraderesult);
          }

          if (Game.time % 1242 === 0) {
            // We're in range
            creep.signController(ctrl, signature);
          }
        } else {
          creep.goTo(ctrl, { range: 1 });
        }
      }
    }
  }
}

export const roleDowngrader = new RoleDowngrader();
