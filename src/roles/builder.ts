import { sourceManager } from "../utils/source-manager";
import { findRestSpot } from "utils/finder";
import { profiler } from "../utils/profiler";
import { wallsMinHp, rampartMinHp } from "constants/misc";
import { roleHarvester } from "./harvester";
import { getObstaclesToAvoidRangedEnemies } from "utils/misc-utils";

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
    const nukes = room.find(FIND_NUKES);

    const getNukeDamageAtLocation = (pos: RoomPosition) =>
      _.sum(
        nukes.map(n => (n.pos.x === pos.x && n.pos.y === pos.y ? 10000000 : n.pos.inRangeTo(pos, 2) ? 5000000 : 0))
      );

    var lowRampart = room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "rampart" && i.hits < 1000
    })[0] as (StructureRampart | undefined);
    if (lowRampart) {
      return {
        object: lowRampart,
        isConstructionSite: false
      };
    }
    var constructionSite = room.find(FIND_CONSTRUCTION_SITES)[0];

    if (constructionSite && (!room.memory.isUnderSiege || constructionSite.structureType === "rampart")) {
      return {
        object: constructionSite,
        isConstructionSite: true
      };
    }

    const controllerLevel = room.controller ? room.controller.level : 0;
    var minWallsHp = wallsMinHp(controllerLevel);
    var minRampartsHp = rampartMinHp(controllerLevel);

    var walls = room.find(FIND_STRUCTURES, {
      filter: i =>
        i.structureType === "constructedWall" && i.hits > 0 && (i.hits < minWallsHp || forceFind) && i.hits < i.hitsMax
    }) as (StructureWall | StructureRampart)[];

    var rampart = room.find(FIND_STRUCTURES, {
      filter: i =>
        i.structureType === "rampart" &&
        (i.hits - getNukeDamageAtLocation(i.pos) < minRampartsHp || forceFind) &&
        i.hits < i.hitsMax
    }) as (StructureWall | StructureRampart)[];

    var rampartAndWalls = walls
      .concat(rampart)
      .map(r => ({ element: r, hits: r.hits - getNukeDamageAtLocation(r.pos) }));

    rampartAndWalls.sort((a, b) => a.hits - b.hits);

    if (rampartAndWalls.length) {
      return {
        object: rampartAndWalls[0].element,
        isConstructionSite: false
      };
    }
    return null;
  }

  run(creep: Creep) {
    const memory: IBuilderMemory = creep.memory as any;
    const moveOptions: TravelToOptions = {};
    memory.s = Game.time;

    if (creep.room.memory.isUnderSiege) {
      moveOptions.obstacles = getObstaclesToAvoidRangedEnemies(creep);

      // during sieges, refresh more often
      if (Game.time % 20 === 0) {
        this.resetTarget(memory, creep.room);
      }
    }

    if (memory.subRole) {
      const targetRoom = memory.subRole;
      if (targetRoom !== creep.room.name) {
        creep.goTo(new RoomPosition(25, 25, targetRoom), moveOptions);
        return;
      }
    }

    if (!memory.targetStructure) {
      this.resetTarget(memory, creep.room);
      if (!memory.targetStructure) {
        // suicide
        // console.log("Suiciding idle builder", creep.room.name);
        // creep.suicide();
        if (creep.room.name != memory.homeRoom) {
          return roleHarvester.run(creep);
        }
        return this.goToRest(creep);
      }
    }

    if (memory.building === undefined) {
      memory.building = false;
    }

    if (memory.building && creep.carry.energy == 0) {
      memory.building = false;
      this.resetTarget(memory, creep.room);
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
          creep.goTo(targetObject, moveOptions);
        } else {
          memory.s = Game.time;
        }
      } else {
        var structureObject = targetObject as AnyStructure;
        if (structureObject.hits === structureObject.hitsMax) {
          this.resetTarget(memory, creep.room);
          return;
        }

        var repairResult = creep.repair(structureObject);
        if (repairResult == ERR_NOT_IN_RANGE) {
          creep.goTo(targetObject, moveOptions);
        }
      }
    } else if (sourceManager.getEnergy(creep) !== OK) {
      const hasStaticHarvesters = !!creep.room.find(FIND_MY_CREEPS, {
        filter: i => i.memory.role === "static-harvester"
      });

      if (memory.subRole || !hasStaticHarvesters) {
        // harvest ourselves
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
      creep.goTo(restSpot, { range: 3 });
    }
  }
}

profiler.registerClass(RoleBuilder, "RoleBuilder");

export const roleBuilder = new RoleBuilder();
