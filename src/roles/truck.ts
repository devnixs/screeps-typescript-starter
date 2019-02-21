import { sourceManager } from "../utils/source-manager";

interface ITruckMemory extends CreepMemory {
  isDepositing?: boolean;
}

class RoleTruck implements IRole {
  run(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (memory.isDepositing && totalCargoContent === 0) {
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && totalCargoContent === creep.carryCapacity) {
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      // if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
      // take the energy from the containers because we need to fill the extensions qui
      // sourceManager.getEnergy(creep);
      //} else {
      sourceManager.harvestEnergyFromSource(creep);
      //}
    } else {
      sourceManager.store(creep);
    }
  }
}

export const roleTruck = new RoleTruck();
