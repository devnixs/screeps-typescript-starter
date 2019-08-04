import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";
import { flee, runFromTimeToTime } from "utils/misc-utils";

export interface ILongDistanceHarvesterMemory extends CreepMemory {
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetRoomName: string;
  targetRoomX: number;
  targetRoomY: number;
  sittingOnContainer: boolean;
  sourceId: string;
}

class RoleLongDistanceHarvester implements IRole {
  run(creep: Creep) {
    const memory: ILongDistanceHarvesterMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (flee(creep) === OK) {
      memory.sittingOnContainer = false;
      return;
    }

    if (totalCargoContent >= creep.carryCapacity / 2 && creep.getActiveBodyparts(CARRY)) {
      if (runFromTimeToTime(5, 10)) {
        const constructionSite = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
          filter: i => i.structureType === "container"
        })[0];
        if (constructionSite) {
          if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
            creep.goTo(constructionSite);
          }
          return;
        }
      }

      if (runFromTimeToTime(5, 20)) {
        const damagedContainer = creep.pos
          .lookFor("structure")
          .filter(i => i.structureType === "container" && i.hits < i.hitsMax * 0.75)[0];

        if (damagedContainer) {
          creep.repair(damagedContainer);
          return;
        }
      }
    }

    if (memory.sittingOnContainer && memory.sourceId) {
      const source = Game.getObjectById(memory.sourceId) as Source;
      creep.harvest(source);
      return;
    }

    // if in target room
    if (creep.room.name == memory.targetRoomName) {
      let source: Source;
      if (memory.sourceId) {
        source = Game.getObjectById(memory.sourceId) as Source;
      } else {
        source = creep.room.lookForAt(
          "source",
          new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName)
        )[0];
        if (source) {
          memory.sourceId = source.id;
        }
      }

      if (source) {
        const container = creep.room.find(FIND_STRUCTURES, {
          filter: i => i.structureType === "container" && i.pos.isNearTo(source.pos)
        })[0];
        if (container) {
          if (creep.pos.getRangeTo(container) > 0) {
            creep.goTo(container);
            return;
          }
          if (creep.pos.getRangeTo(container) === 0) {
            memory.sittingOnContainer = true;
            return;
          }
        } else {
          if (creep.pos.isNearTo(source)) {
            creep.harvest(source);
          } else {
            creep.goTo(source);
          }
        }
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
