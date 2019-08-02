import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { profiler } from "../utils/profiler";
import { O_NOFOLLOW } from "constants";
import { findRestSpot } from "utils/finder";

interface IMinerMemory extends CreepMemory {
  isDepositing?: boolean;
  isSittingOnTopOfContainer: boolean;
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
        creep.suicide();
        return;
      }
    } else {
      if (sourceManager.storeInCloseContainer(creep) !== OK) {
        sourceManager.store(creep);
      }
    }
  }
  goToRest(creep: Creep) {
    const restSpot = findRestSpot(creep);
    if (restSpot) {
      creep.goTo(restSpot, { range: 3 });
    }
  }
}

profiler.registerClass(RoleMiner, "RoleMiner");
export const roleMiner = new RoleMiner();
