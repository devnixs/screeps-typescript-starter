import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";
import { findHostile } from "utils/finder";

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

    const enemy = findHostile(creep);
    if (enemy && enemy.pos.getRangeTo(creep.pos.x, creep.pos.y) < 10) {
      // flee
      creep.say("RUN!");
      const homeRoom = Game.rooms[memory.homeRoom].find(FIND_MY_SPAWNS)[0];
      creep.goTo(homeRoom);
      return;
    }

    // if creep is bringing energy to a structure but has no energy left
    if (memory.depositing == true && totalCargoContent == 0) {
      // switch state
      memory.depositing = false;
      delete memory.targetContainer;
    }
    // if creep is harvesting energy but is full
    else if (!memory.depositing && totalCargoContent == creep.carryCapacity) {
      // switch state
      memory.depositing = true;
      delete memory.targetContainer;
    }

    // if creep is supposed to transfer energy to a structure
    if (memory.depositing == true) {
      // first let's see if a road needs to be built
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (
        constructionSite &&
        constructionSite.pos.inRangeTo(creep, 5) &&
        constructionSite.structureType !== "rampart"
      ) {
        if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
          creep.goTo(constructionSite);
        }
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
      const droppedEnergyInRange = creep.pos
        .findInRange(FIND_DROPPED_RESOURCES, 1)
        .filter(i => i.resourceType === "energy" && i.amount > 50)[0];
      if (droppedEnergyInRange) {
        creep.pickup(droppedEnergyInRange);
        return;
      }

      // if in target room
      const container = Game.getObjectById(memory.targetContainer) as StructureContainer;
      if (!container) {
        return;
      }
      if (creep.room.name == container.room.name) {
        const withdrawResult = creep.withdraw(container, "energy");
        if (withdrawResult === ERR_NOT_IN_RANGE) {
          creep.goTo(container);
        }
        if (withdrawResult === OK) {
          memory.depositing = true;
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
