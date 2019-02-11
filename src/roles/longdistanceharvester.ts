import { findAndCache } from "utils/finder";

/* import { sourceManager } from "../utils/source-manager";
import { findAndCache } from "utils/finder";
 */
export interface ILongDistanceHarvesterMemory extends CreepMemory {
  working?: boolean;
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetRoomName: string;
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
        let structure: AnyStructure | undefined = findAndCache<FIND_STRUCTURES>(
          creep,
          "deposit_structure_id",
          FIND_STRUCTURES,
          (targetStructure: any) => targetStructure.energy < targetStructure.energyCapacity,
          {
            filter: (structure: StructureSpawn | StructureExtension | StructureTower) => {
              return (
                (structure.structureType == STRUCTURE_EXTENSION ||
                  structure.structureType == STRUCTURE_SPAWN ||
                  structure.structureType == STRUCTURE_TOWER) &&
                structure.energy < structure.energyCapacity
              );
            }
          }
        ) as any;

        if (structure == undefined) {
          structure = creep.room.storage;
        }

        // if we found one
        if (structure != undefined) {
          // try to transfer energy, if it is not in range
          if (creep.transfer(structure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            // move towards it
            creep.moveTo(structure, { reusePath: 25 });
          }
        }
      }
      // if not in home room...
      else {
        // find exit to home room
        creep.moveTo(new RoomPosition(memory.homeSpawnPosition.x, memory.homeSpawnPosition.y, memory.home), {
          reusePath: 25
        });
      }
    }
    // if creep is supposed to harvest energy from source
    else {
      // if in target room
      if (creep.room.name == memory.targetRoomName) {
        // find source
        var source = creep.pos.findClosestByPath(FIND_SOURCES);

        // try to harvest energy, if the source is not in range
        if (source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
          // move towards the source
          creep.moveTo(source);
        }
      }
      // if not in target room
      else {
        // find exit to target room
        var exit = creep.room.findExitTo(memory.targetRoomName);
        var exitPos: RoomPosition = creep.room.find(exit as any)[0] as any;

        // move to exit
        creep.moveTo(exitPos, { reusePath: 25 });
      }
    }
  }
}

export const roleLongDistanceHarvester = new RoleLongDistanceHarvester();
