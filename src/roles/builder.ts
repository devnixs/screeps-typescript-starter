import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { defaultReusePath } from "../constants";

interface IBuilderMemory extends CreepMemory {
  building: boolean;
}

class RoleBuilder implements IRole {
  run(creep: Creep) {
    const memory: IBuilderMemory = creep.memory as any;

    if (memory.subRole) {
      const targetRoom = memory.subRole;
      if (targetRoom !== creep.room.name) {
        creep.goTo(new RoomPosition(25, 25, targetRoom));
        return;
      }
    }

    var constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (constructionSites.length === 0) {
      roleHarvester.run(creep);
      return;
    }
    if (memory.building && creep.carry.energy == 0) {
      memory.building = false;
      creep.say("🔄 harvest");
    }
    if (!memory.building && creep.carry.energy == creep.carryCapacity) {
      memory.building = true;
      creep.say("🚧 build");
    }

    if (memory.building) {
      if (creep.build(constructionSites[0]) == ERR_NOT_IN_RANGE) {
        creep.goTo(constructionSites[0]);
      }
    } else {
      sourceManager.getEnergy(creep);
    }
  }
}

export const roleBuilder = new RoleBuilder();
