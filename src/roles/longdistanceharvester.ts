import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";
import { findHostile } from "utils/finder";

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

    const enemy = findHostile(creep);
    if (enemy && enemy.pos.getRangeTo(creep.pos.x, creep.pos.y) < 10) {
      // flee
      creep.say("RUN!");
      const homeRoom = Game.rooms[memory.homeRoom].find(FIND_MY_SPAWNS)[0];
      creep.goTo(homeRoom);
      return;
    }

    if (totalCargoContent >= creep.carryCapacity / 2 && creep.getActiveBodyparts(CARRY)) {
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
        filter: i => i.structureType === "container"
      });
      if (constructionSite && constructionSite.pos.inRangeTo(creep, 5)) {
        if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
          creep.goTo(constructionSite);
        }
        return;
      }
      const damagedContainer = creep.pos
        .lookFor("structure")
        .filter(i => i.structureType === "container" && i.hits < i.hitsMax * 0.75)[0];

      if (damagedContainer) {
        creep.repair(damagedContainer);
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
          return;
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
