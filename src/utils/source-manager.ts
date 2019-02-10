class SourceManager {
  harvestEnergyFromSource(creep: Creep) {
    // var sources = creep.room.find(FIND_SOURCES);
    const sources = creep.pos.findClosestByPath(FIND_SOURCES);
    if (!sources) {
      return;
    }

    if (creep.harvest(sources) == ERR_NOT_IN_RANGE) {
      creep.moveTo(sources, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  }
}

export const sourceManager = new SourceManager();
