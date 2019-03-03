import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { profiler } from "../utils/profiler";
import { O_NOFOLLOW } from "constants";

interface IMinerMemory extends CreepMemory {
  isDepositing?: boolean;
}

class RoleMiner implements IRole {
  run(creep: Creep) {
    const memory: IMinerMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (memory.isDepositing && totalCargoContent === 0) {
      creep.say("Mining");
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && totalCargoContent === creep.carryCapacity) {
      creep.say("Depositing");
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      if (sourceManager.mineMineral(creep) !== OK) {
        return roleHarvester.run(creep);
      }
    } else {
      if (sourceManager.storeInCloseContainer(creep) !== OK) {
        sourceManager.store(creep);
      }
    }
  }
}

profiler.registerClass(RoleMiner, "RoleMiner");
export const roleMiner = new RoleMiner();
