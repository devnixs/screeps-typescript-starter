import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";

interface IReparatorMemory extends CreepMemory {
  repairing: boolean;
  damagedId: string | null;
}

class RoleReparator implements IRole {
  run(creep: Creep) {
    const memory: IReparatorMemory = creep.memory as any;
    if (memory.repairing && creep.carry.energy == 0) {
      memory.repairing = false;
      creep.say("🔄 harvest");
    }
    if (!memory.repairing && creep.carry.energy == creep.carryCapacity) {
      memory.repairing = true;
      creep.say("⚡ repair");
    }

    const wallCap = 100000;

    let damaged: AnyStructure | null = null;
    if (memory.damagedId) {
      damaged = Game.getObjectById(memory.damagedId);

      const isWallCapped =
        damaged &&
        (damaged.structureType === STRUCTURE_WALL || damaged.structureType === STRUCTURE_RAMPART) &&
        damaged.hits > wallCap;
      const isCapped = damaged && damaged.hits === damaged.hitsMax;

      if (isCapped || isWallCapped) {
        memory.damagedId = null;
        damaged = null;
      }
    }

    if (!damaged) {
      var damagedOther = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: structure =>
          (structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_RAMPART) ||
          (structure.hits <= wallCap && structure.structureType == STRUCTURE_RAMPART)
      });

      var damagedRoads = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => structure.hits < structure.hitsMax && structure.structureType == STRUCTURE_ROAD
      });

      var damagedWalls = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => structure.hits <= wallCap && structure.structureType == STRUCTURE_WALL
      });

      damaged = damagedOther || damagedRoads || damagedWalls;
      memory.damagedId = damaged && damaged.id;
    }

    if (!damaged) {
      roleHarvester.run(creep);
      return;
    }

    if (memory.repairing) {
      if (creep.repair(damaged) == ERR_NOT_IN_RANGE) {
        creep.goTo(damaged);
      }
    } else {
      sourceManager.getEnergy(creep);
    }
  }
}

export const roleReparator = new RoleReparator();
