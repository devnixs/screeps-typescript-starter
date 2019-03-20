import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "../utils/finder";
import { boostCreep } from "../utils/boost-manager";

export interface IDismantlerMemory extends CreepMemory {}

class RoleDismantler implements IRole {
  isCloseToExit(creep: Creep) {
    return creep.pos.x <= 2 || creep.pos.y <= 2 || creep.pos.x >= 48 || creep.pos.y >= 48;
  }
  run(creep: Creep) {
    if (boostCreep(creep) === OK) {
      // Don't do anything else
      return;
    }

    let hostile: Creep | null = null;
    hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    if (hostile) {
      creep.rangedAttack(hostile);
    }

    const attackFlag = Game.flags["dismantler_attack"];
    const healersReady = creep.pos.findInRange(FIND_MY_CREEPS, 4, { filter: i => i.memory.role === "healer" });

    if (attackFlag && (healersReady.length >= requiredHealersForAnAttack || this.isCloseToExit(creep))) {
      if (attackFlag.room && attackFlag.room.name === creep.room.name) {
        // we need at least two healers close
        const healersClose = creep.pos.findInRange(FIND_MY_CREEPS, 2, { filter: i => i.memory.role === "healer" });

        const targetStructures = creep.room.lookForAt(LOOK_STRUCTURES, attackFlag);
        let targetStructure = targetStructures[0];

        targetStructure =
          targetStructure ||
          creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType === "tower" });

        targetStructure =
          targetStructure ||
          creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType === "spawn" });

        targetStructure =
          targetStructure ||
          creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES, { filter: i => i.structureType === "tower" });

        targetStructure =
          targetStructure ||
          creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: i => i.structureType !== "rampart" && i.structureType !== "controller"
          });

        targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);

        targetStructure =
          targetStructure ||
          creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: i => i.structureType !== "road"
          });

        if (targetStructure) {
          if (creep.dismantle(targetStructure) === ERR_NOT_IN_RANGE) {
            if (healersClose.length >= requiredHealersForAnAttack || this.isCloseToExit(creep)) {
              creep.goTo(targetStructure);
            }
            creep.dismantle(targetStructure);
          }
        }
      } else {
        creep.goTo(attackFlag);
      }
      return;
    }

    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
      return;
    }

    let restSpot: RoomPosition | null;
    restSpot = Game.flags["dismantler_rest"] && Game.flags["dismantler_rest"].pos;
    restSpot = restSpot || findRestSpot(creep);
    if (restSpot) {
      creep.goTo(restSpot);
    }
  }
}

export const roleDismantler = new RoleDismantler();
