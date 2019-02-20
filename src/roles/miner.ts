import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";

interface IMinerMemory extends CreepMemory {
  isDepositing?: boolean;
}

class RoleMiner implements IRole {
  run(creep: Creep) {
    const memory: IMinerMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (memory.isDepositing && totalCargoContent === 0) {
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && totalCargoContent === creep.carryCapacity) {
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      if (sourceManager.mineMineral(creep) !== OK) {
        return roleHarvester.run(creep);
      }
    } else {
      sourceManager.store(creep);
    }
  }
}

export const roleMiner = new RoleMiner();
