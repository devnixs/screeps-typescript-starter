import { sourceManager } from "../utils/source-manager";
import { profiler } from "../utils/profiler";

export interface IHarvesterMemory extends CreepMemory {
  isDepositing?: boolean;
  targetContainerId?: string;
  isSittingOnTargetContainer: string;
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
      const specificSource: Source | null = memory.subRole ? Game.getObjectById(memory.subRole) : null;
      if (specificSource) {
        sourceManager.harvestEnergyFromSpecificSource(creep, specificSource);
      } else {
        sourceManager.harvestEnergyFromSource(creep);
      }
      // }
    } else {
      if (this.buildContainer(creep) === OK) {
        return;
      } else if (sourceManager.storeInCloseContainer(creep) === OK) {
        return;
      } else {
        sourceManager.store(creep);
      }
    }
  }

  buildContainer(creep: Creep) {
    const closeContainerToBuild: ConstructionSite[] = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 1);
    if (closeContainerToBuild.length) {
      return creep.build(closeContainerToBuild[0]);
    } else {
      return -1;
    }
  }
}
profiler.registerClass(RoleHarvester, "RoleHarvester");
export const roleHarvester = new RoleHarvester();
