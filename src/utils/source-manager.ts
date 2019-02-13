import { findAndCache } from "./finder";
import { defaultReusePath } from "../constants";

class SourceManager {
  harvestEnergyFromSource(creep: Creep) {
    const targetEnergySource = findAndCache<FIND_SOURCES>(
      creep,
      "harvest_source_id",
      FIND_SOURCES,
      (targetStructure: Source) => targetStructure.energy > 0,
      {
        filter: (structure: Source) => {
          return structure.energy > 0;
        }
      }
    );

    if (!targetEnergySource) {
      return;
    }

    const distanceX = Math.abs(creep.pos.x - targetEnergySource.pos.x);
    const distanceY = Math.abs(creep.pos.y - targetEnergySource.pos.y);
    if (distanceX <= 1 && distanceY <= 1) {
      const harvestResult = creep.harvest(targetEnergySource);
      if (harvestResult !== OK) {
        console.log("Failed to harvest : ", harvestResult);
      }
    } else {
      creep.moveTo(targetEnergySource, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: defaultReusePath });
    }
  }
  harvestEnergyFromSpecificSource(creep: Creep, source: Source) {
    if (!source) {
      return;
    }

    const distanceX = Math.abs(creep.pos.x - source.pos.x);
    const distanceY = Math.abs(creep.pos.y - source.pos.y);
    if (distanceX <= 1 && distanceY <= 1) {
      const harvestResult = creep.harvest(source);
      if (harvestResult !== OK) {
        console.log("Failed to harvest : ", harvestResult);
      }
    } else {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: defaultReusePath });
    }
  }
  getEnergy(creep: Creep) {
    const targetStructure = findAndCache<FIND_STRUCTURES>(
      creep,
      "harvest_container_id",
      FIND_STRUCTURES,
      (targetStructure: any) => targetStructure.store.energy > 0,
      {
        filter: (structure: StructureContainer) => {
          return structure.structureType == STRUCTURE_CONTAINER && structure.store.energy > 0;
        }
      }
    ) as any;

    if (targetStructure) {
      if (creep.withdraw(targetStructure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(targetStructure, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: defaultReusePath });
      }
    } else {
      this.harvestEnergyFromSource(creep);
    }
  }
  storeEnergy(creep: Creep) {
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

    if (!targetStructure) {
      targetStructure = findAndCache<FIND_STRUCTURES>(
        creep,
        "deposit_container_id",
        FIND_STRUCTURES,
        (targetStructure: any) => targetStructure.store.energy < targetStructure.storeCapacity,
        {
          filter: (structure: StructureContainer) => {
            return structure.structureType == STRUCTURE_CONTAINER && structure.store.energy < structure.storeCapacity;
          }
        }
      ) as any;
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

export const sourceManager = new SourceManager();
