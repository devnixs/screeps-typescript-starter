import { sourceManager } from "../utils/source-manager";
import { profiler } from "../utils/profiler";

interface IUpgraderMemory extends CreepMemory {
  upgrading: boolean;
}

class RoleUpgrader implements IRole {
  run(creep: Creep) {
    const memory: IUpgraderMemory = creep.memory as any;
    if (memory.upgrading && creep.carry.energy == 0) {
      memory.upgrading = false;
      creep.say("🔄 harvest");
    }
    if (!memory.upgrading && creep.carry.energy > 0) {
      memory.upgrading = true;
      creep.say("⚡ upgrade");
    }

    if (memory.upgrading) {
      if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.goTo(creep.room.controller);
        }
      }
    } else {
      sourceManager.getEnergy(creep);
    }
  }
}

profiler.registerClass(RoleUpgrader, "RoleUpgrader");
export const roleUpgrader = new RoleUpgrader();
