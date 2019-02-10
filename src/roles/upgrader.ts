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
      if (creep.room.controller && creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    } else {
      sourceManager.harvestEnergyFromSource(creep);
    }
  }
}

export const roleUpgrader = new RoleUpgrader();
