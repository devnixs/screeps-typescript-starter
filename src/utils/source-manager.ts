import { findAndCache } from "./finder";

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

    if (creep.harvest(targetEnergySource) == ERR_NOT_IN_RANGE) {
      creep.moveTo(targetEnergySource, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: 20 });
    }
  }
}

export const sourceManager = new SourceManager();
