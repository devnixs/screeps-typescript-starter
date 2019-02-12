import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { defaultReusePath } from "../constants";

interface IBuilderMemory extends CreepMemory {
  building: boolean;
}

class RoleBuilder implements IRole {
  run(creep: Creep) {
    const memory: IBuilderMemory = creep.memory as any;
    if (memory.building && creep.carry.energy == 0) {
      memory.building = false;
      creep.say("🔄 harvest");
    }
    if (!memory.building && creep.carry.energy == creep.carryCapacity) {
      memory.building = true;
      creep.say("🚧 build");
    }

    if (memory.building) {
      var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (targets.length) {
        if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" }, reusePath: defaultReusePath });
        }
      } else {
        roleHarvester.run(creep);
      }
    } else {
      sourceManager.getEnergy(creep);
    }
  }
}

export const roleBuilder = new RoleBuilder();
