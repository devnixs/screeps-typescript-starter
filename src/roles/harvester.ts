import { sourceManager } from "../utils/source-manager";
import { defaultReusePath } from "../constants";
import { findAndCache } from "utils/finder";

interface IHarvesterMemory extends CreepMemory {}

class RoleHarvester implements IRole {
  run(creep: Creep) {
    const memory: IHarvesterMemory = creep.memory as any;

    if (creep.carry.energy < creep.carryCapacity) {
      sourceManager.harvestEnergyFromSource(creep);
    } else {
      let targetStructure: AnyStructure | undefined = findAndCache<FIND_STRUCTURES>(
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

      if (targetStructure == undefined) {
        targetStructure = creep.room.storage;
      }

      if (targetStructure) {
        if (creep.transfer(targetStructure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targetStructure, { visualizePathStyle: { stroke: "#ffffff" }, reusePath: defaultReusePath });
        }
      } else {
        creep.moveTo(Game.flags["worker_rest"], { reusePath: defaultReusePath });
      }
    }
  }
}

export const roleHarvester = new RoleHarvester();
