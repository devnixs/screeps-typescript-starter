import { sourceManager } from "../utils/source-manager";
import { defaultReusePath } from "../constants";
import { findAndCache } from "utils/finder";

interface IHarvesterMemory extends CreepMemory {
  isDepositing?: boolean;
}

class RoleHarvester implements IRole {
  run(creep: Creep) {
    const memory: IHarvesterMemory = creep.memory as any;

    if (memory.isDepositing && creep.carry.energy === 0) {
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && creep.carry.energy === creep.carryCapacity) {
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      sourceManager.harvestEnergyFromSource(creep);
    } else {
      sourceManager.storeEnergy(creep);
    }
  }
}

export const roleHarvester = new RoleHarvester();
