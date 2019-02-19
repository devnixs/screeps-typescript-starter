import { findAndCache } from "utils/finder";
import { defaultReusePath } from "../constants";
import { sourceManager } from "utils/source-manager";

/* import { sourceManager } from "../utils/source-manager";
import { findAndCache } from "utils/finder";
 */
export interface ILongDistanceHarvesterMemory extends CreepMemory {
  working?: boolean;
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetRoomName: string;
  targetRoomX: number;
  targetRoomY: number;
}

class RoleLongDistanceHarvester implements IRole {
  run(creep: Creep) {
    const memory: ILongDistanceHarvesterMemory = creep.memory as any;

    // if creep is bringing energy to a structure but has no energy left
    if (memory.working == true && creep.carry.energy == 0) {
      // switch state
      memory.working = false;
    }
    // if creep is harvesting energy but is full
    else if (!memory.working && creep.carry.energy == creep.carryCapacity) {
      // switch state
      memory.working = true;
    }

    // if creep is supposed to transfer energy to a structure
    if (memory.working == true) {
      // if in home room
      if (creep.room.name == memory.home) {
        sourceManager.storeEnergy(creep);
      }
      // if not in home room...
      else {
        // first let's see if a road needs to be built
        const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
        if (constructionSite) {
          if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
            creep.goTo(constructionSite);
          }
          return;
        }

        const damagedRoad: StructureRoad = creep.pos.findInRange(FIND_STRUCTURES, 3, {
          filter: structure => structure.structureType === "road" && structure.hits < structure.hitsMax
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
      if (creep.room.name == memory.targetRoomName) {
        const source = creep.room.lookForAt(
          "source",
          new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName)
        )[0];
        if (source) {
          sourceManager.harvestEnergyFromSpecificSource(creep, source);
        }
      }
      // if not in target room
      else {
        if (memory.targetRoomX && memory.targetRoomY && memory.targetRoomName) {
          creep.goTo(new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName));
        }
      }
    }
  }
}

export const roleLongDistanceHarvester = new RoleLongDistanceHarvester();
