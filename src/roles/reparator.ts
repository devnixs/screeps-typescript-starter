import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";

interface IReparatorMemory extends CreepMemory {
  repairing: boolean;
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

    var damagedOther = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: structure => structure.hits < structure.hitsMax
    });

    var damagedRoads = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure => structure.hits < structure.hitsMax && structure.structureType == STRUCTURE_ROAD
    });

    const damaged = damagedOther || damagedRoads;

    if (!damaged) {
      roleHarvester.run(creep);
      return;
    }

    if (memory.repairing) {
      if (creep.repair(damaged) == ERR_NOT_IN_RANGE) {
        creep.moveTo(damaged, { visualizePathStyle: { stroke: "#ffffff" }, reusePath: 25 });
      }
    } else {
      // withdraw energy from structures
      var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: structure => {
          return (
            (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
            structure.energy > 0
          );
        }
      }) as StructureSpawn;
      if (target) {
        if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" }, reusePath: 25 });
        }
      }
    }
  }
}

export const roleReparator = new RoleReparator();
