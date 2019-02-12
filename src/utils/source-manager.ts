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
}

export const sourceManager = new SourceManager();
