import { defaultReusePath } from "../constants";
import { sourceManager } from "../utils/source-manager";

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
    if (!memory.upgrading && creep.carry.energy == creep.carryCapacity) {
      memory.upgrading = true;
      creep.say("⚡ upgrade");
    }

    if (memory.upgrading) {
      if (creep.room.controller) {
        creep.upgradeController(creep.room.controller);
        creep.goTo(creep.room.controller);
      }
    } else {
      sourceManager.getEnergy(creep);
    }
  }
}

export const roleUpgrader = new RoleUpgrader();
