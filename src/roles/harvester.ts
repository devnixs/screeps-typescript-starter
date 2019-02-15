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
      if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
        // take the energy from the containers because we need to fill the extensions qui
        sourceManager.getEnergy(creep);
      } else {
        sourceManager.harvestEnergyFromSource(creep);
      }
    } else {
      sourceManager.storeEnergy(creep);
    }
  }
}

export const roleHarvester = new RoleHarvester();
