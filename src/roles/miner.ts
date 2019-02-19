import { sourceManager } from "../utils/source-manager";
import { defaultReusePath } from "../constants";
import { findAndCache } from "utils/finder";
import { roleHarvester } from "./harvester";

interface IMinerMemory extends CreepMemory {
  isDepositing?: boolean;
}

class RoleMiner implements IRole {
  run(creep: Creep) {
    const memory: IMinerMemory = creep.memory as any;

    const carrying = sourceManager.getCurrentCarryingMineral(creep);

    if (memory.isDepositing && !carrying) {
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && carrying && creep.carry[carrying] === creep.carryCapacity) {
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      if (sourceManager.mineMineral(creep) !== OK) {
        return roleHarvester.run(creep);
      }
    } else {
      sourceManager.storeMineral(creep);
    }
  }
}

export const roleMiner = new RoleMiner();
