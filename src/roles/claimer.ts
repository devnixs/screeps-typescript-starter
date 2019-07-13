import { ConquestManager } from "managers/conquest";

interface IClaimerMemory extends CreepMemory {}

class RoleClaimer implements IRole {
  run(creep: Creep) {
    const memory: IClaimerMemory = creep.memory as any;

    const flag = Game.flags["claimer_target"];

    if (!flag) {
      return;
    }

    if (flag.room && flag.room.name == creep.room.name) {
      var ctrl = flag.room.controller;
      if (!ctrl) {
        return;
      }

      if (ctrl.my) {
        // mission is a success.
        ConquestManager.onNewRoom(creep.room);

        // no need to do anything more
        creep.suicide();
        return;
      }

      if (ctrl.owner) {
        const attackResult = creep.attackController(ctrl);
        console.log("Attack ctrl result", attackResult);
        if (attackResult === ERR_NOT_IN_RANGE) {
          creep.goTo(ctrl);
        }
      } else {
        const claimResult = creep.claimController(ctrl);
        if (claimResult === ERR_GCL_NOT_ENOUGH) {
          creep.reserveController(ctrl);
        } else if (creep.claimController(ctrl) === ERR_NOT_IN_RANGE) {
          creep.goTo(ctrl);
        }
      }
    } else {
      creep.goTo(flag);
    }
  }
}

export const roleClaimer = new RoleClaimer();
