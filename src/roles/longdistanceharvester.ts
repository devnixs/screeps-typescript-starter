import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";

export interface ILongDistanceHarvesterMemory extends CreepMemory {
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetRoomName: string;
  targetRoomX: number;
  targetRoomY: number;
}

class RoleLongDistanceHarvester implements IRole {
  run(creep: Creep) {
    const memory: ILongDistanceHarvesterMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (totalCargoContent > 0) {
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (constructionSite && constructionSite.pos.inRangeTo(creep, 5)) {
        creep.goTo(constructionSite);
        creep.build(constructionSite);
        return;
      }
    }

    // if in target room
    if (creep.room.name == memory.targetRoomName) {
      const source = creep.room.lookForAt(
        "source",
        new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName)
      )[0];

      if (source) {
        const container = creep.room.find(FIND_STRUCTURES, {
          filter: i => i.structureType === "container" && i.pos.isNearTo(source.pos)
        })[0];
        if (container && creep.pos.getRangeTo(container) > 0) {
          creep.goTo(container);
        }

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

profiler.registerClass(RoleLongDistanceHarvester, "RoleLongDistanceHarvester");
export const roleLongDistanceHarvester = new RoleLongDistanceHarvester();
