import { sourceManager } from "../utils/source-manager";
import { profiler } from "../utils/profiler";

export interface IStaticHarvesterMemory extends CreepMemory {
  targetContainerId: string;
  isSittingOnTargetContainer: boolean;
}

class RoleStaticHarvester implements IRole {
  run(creep: Creep) {
    const memory: IStaticHarvesterMemory = creep.memory as any;

    const source = Game.getObjectById(memory.subRole) as Source;
    if (memory.isSittingOnTargetContainer) {
      creep.harvest(source);
    } else {
      const targetContainer = Game.getObjectById(memory.targetContainerId) as StructureContainer;
      creep.goTo(targetContainer);
      if (creep.pos.isEqualTo(targetContainer.pos.x, targetContainer.pos.y)) {
        memory.isSittingOnTargetContainer = true;
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
profiler.registerClass(RoleStaticHarvester, "RoleStaticHarvester");
export const roleStaticHarvester = new RoleStaticHarvester();
