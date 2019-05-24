import { sourceManager } from "../utils/source-manager";
import { findRestSpot } from "utils/finder";
import { profiler } from "../utils/profiler";
import { wallsMinHp, rampartMinHp } from "constants/misc";

interface IBuilderMemory extends CreepMemory {
  building: boolean;
  targetStructure: string | null;
  isConstructionSite: boolean | null;
  lastCheck: number | null;
}

export class RoleBuilder implements IRole {
  static findTargetStructure(
    room: Room,
    forceFind: boolean
  ): { object: ConstructionSite | StructureWall | StructureRampart; isConstructionSite: boolean } | null {
    var constructionSites = room.find(FIND_CONSTRUCTION_SITES);

    if (constructionSites.length) {
      return {
        object: constructionSites[0],
        isConstructionSite: true
      };
    }

    const controllerLevel = room.controller ? room.controller.level : 0;
    var minWallsHp = wallsMinHp(controllerLevel);
    var minRampartsHp = rampartMinHp(controllerLevel);
    var walls = room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "constructedWall" && i.hits > 0 && (i.hits < minWallsHp || forceFind)
    }) as (StructureWall | StructureRampart)[];

    var rampart = room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "rampart" && (i.hits < minRampartsHp || forceFind)
    }) as (StructureWall | StructureRampart)[];

    var rampartAndWalls = walls.concat(rampart);

    rampartAndWalls.sort((a, b) => a.hits - b.hits);

    if (rampartAndWalls.length) {
      return {
        object: rampartAndWalls[0],
        isConstructionSite: false
      };
    }
    return null;
  }

  run(creep: Creep) {
    const memory: IBuilderMemory = creep.memory as any;

    if (memory.subRole) {
      const targetRoom = memory.subRole;
      if (targetRoom !== creep.room.name) {
        creep.goTo(new RoomPosition(25, 25, targetRoom));
        return;
      }
    }

    if (!memory.targetStructure || !memory.lastCheck || memory.lastCheck < Game.time - 500) {
      this.resetTarget(memory, creep.room);
      if (!memory.targetStructure) {
        // suicide
        console.log("Suiciding idle builder", creep.room.name);
        creep.suicide();
        return;
      }
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
      var targetObject = Game.getObjectById(memory.targetStructure) as ConstructionSite | AnyStructure | null;
      if (!targetObject) {
        this.resetTarget(memory, creep.room);
        return;
      }

      if (memory.isConstructionSite) {
        var buildResult = creep.build(targetObject as ConstructionSite);
        if (buildResult == ERR_NOT_IN_RANGE) {
          creep.goTo(targetObject);
        }
      } else {
        var structureObject = targetObject as AnyStructure;
        if (structureObject.hits === structureObject.hitsMax) {
          this.resetTarget(memory, creep.room);
          return;
        }

        var repairResult = creep.repair(structureObject);
        if (repairResult == ERR_NOT_IN_RANGE) {
          creep.goTo(targetObject);
        }
      }
    } else if (sourceManager.getEnergy(creep) !== OK) {
      if (memory.subRole) {
        sourceManager.harvestEnergyFromSource(creep);
      } else {
        return this.goToRest(creep);
      }
    }
  }

  resetTarget(memory: IBuilderMemory, room: Room) {
    memory.targetStructure = null;

    var target = RoleBuilder.findTargetStructure(room, true);
    if (target) {
      memory.targetStructure = target.object.id;
      memory.isConstructionSite = target.isConstructionSite;
      memory.lastCheck = Game.time;
    }
  }

  goToRest(creep: Creep) {
    const restSpot = findRestSpot(creep);
    if (restSpot) {
      creep.goTo(restSpot);
    }
  }
}

profiler.registerClass(RoleBuilder, "RoleBuilder");

export const roleBuilder = new RoleBuilder();
