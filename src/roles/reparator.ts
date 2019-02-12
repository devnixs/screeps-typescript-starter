import { sourceManager } from "../utils/source-manager";
import { defaultReusePath } from "../constants";
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

    let damaged: AnyStructure | null = null;
    if (memory.damagedId) {
      damaged = Game.getObjectById(memory.damagedId);
      if (damaged && damaged.hits === damaged.hitsMax) {
        memory.damagedId = null;
        damaged = null;
      }
    }

    if (!damaged) {
      var damagedOther = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: structure => structure.hits < structure.hitsMax
      });

      var damagedRoads = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure =>
          (structure.hits < structure.hitsMax && structure.structureType == STRUCTURE_ROAD) ||
          structure.structureType == STRUCTURE_CONTAINER
      });

      damaged = damagedOther || damagedRoads;
      memory.damagedId = damaged && damaged.id;
    }

    if (!damaged) {
      roleHarvester.run(creep);
      return;
    }

    if (memory.repairing) {
      if (creep.repair(damaged) == ERR_NOT_IN_RANGE) {
        creep.moveTo(damaged, { visualizePathStyle: { stroke: "#ffffff" }, reusePath: defaultReusePath });
      }
    } else {
      sourceManager.getEnergy(creep);
    }
  }
}

export const roleReparator = new RoleReparator();
