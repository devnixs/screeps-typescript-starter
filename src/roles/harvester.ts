import { sourceManager } from "../utils/source-manager";

interface IHarvesterMemory extends CreepMemory {
  isDepositing?: boolean;
}

class RoleHarvester implements IRole {
  run(creep: Creep) {
    const memory: IHarvesterMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (memory.isDepositing && totalCargoContent === 0) {
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && totalCargoContent === creep.carryCapacity) {
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      // if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
      // take the energy from the containers because we need to fill the extensions quickly
      // sourceManager.getEnergy(creep);
      // } else {
      sourceManager.harvestEnergyFromSource(creep);
      // }
    } else {
      sourceManager.store(creep);
    }
  }
}

export const roleHarvester = new RoleHarvester();
