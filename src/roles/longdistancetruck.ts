import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";

export interface ILongDistanceTruckMemory extends CreepMemory {
  depositing?: boolean;
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetContainer: string | undefined;
}

class RoleLongDistanceTruck implements IRole {
  run(creep: Creep) {
    const memory: ILongDistanceTruckMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    // if creep is bringing energy to a structure but has no energy left
    if (memory.depositing == true && totalCargoContent == 0) {
      // switch state
      memory.depositing = false;
    }
    // if creep is harvesting energy but is full
    else if (!memory.depositing && totalCargoContent == creep.carryCapacity) {
      // switch state
      memory.depositing = true;
    }

    // if creep is supposed to transfer energy to a structure
    if (memory.depositing == true) {
      // first let's see if a road needs to be built
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (constructionSite && constructionSite.pos.inRangeTo(creep, 5)) {
        creep.goTo(constructionSite);
        creep.build(constructionSite);
        return;
      }

      // if in home room
      if (creep.room.name == memory.home) {
        sourceManager.store(creep);
      }
      // if not in home room...
      else {
        const damagedRoad: StructureRoad = creep.pos.findInRange(FIND_STRUCTURES, 3, {
          filter: structure => structure.structureType === "road" && structure.hits < structure.hitsMax * 0.75
        })[0] as any;

        if (damagedRoad) {
          if (creep.repair(damagedRoad) === ERR_NOT_IN_RANGE) {
            creep.goTo(damagedRoad);
          }
          return;
        }

        // find exit to home room
        const moveResult = creep.goTo(
          new RoomPosition(memory.homeSpawnPosition.x, memory.homeSpawnPosition.y, memory.home)
        );
      }
    }
    // if creep is supposed to harvest energy from source
    else {
      // if in target room
      const container = Game.getObjectById(memory.targetContainer) as StructureContainer;
      if (!container) {
        return;
      }
      if (creep.room.name == container.room.name) {
        if (creep.withdraw(container, "energy") === ERR_NOT_IN_RANGE) {
          creep.goTo(container);
        }
        return;
      }
      // if not in target room
      else {
        creep.goTo(container.pos);
      }
    }
  }
}

profiler.registerClass(RoleLongDistanceTruck, "RoleLongDistanceTruck");
export const roleLongDistanceTruck = new RoleLongDistanceTruck();
