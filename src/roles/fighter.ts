import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";

interface IFighterMemory extends CreepMemory {
  assignedExplorerName: string | null;
}

class RoleFighter implements IRole {
  run(creep: Creep) {
    const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);

    let hostile: Creep | null = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    let hostileBuilding: AnyStructure | null = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
    /*
    if (hostile) {
      notify("Hostile creep detected (time=" + Game.time + ")! " + JSON.stringify(hostile), 200);
    }
 */
    const memory: IFighterMemory = creep.memory as any;

    const attackFlag = Game.flags["fighter_attack"];
    if (hostile || hostileBuilding) {
      // && creep.room.controller && creep.room.controller.my) {
      if (creep.attack(hostile || (hostileBuilding as any)) == ERR_NOT_IN_RANGE) {
        creep.goTo(hostile || (hostileBuilding as any));
        return;
      }
    } else {
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
            creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType !== "rampart" });

          if (targetStructure) {
            if (creep.attack(targetStructure) === ERR_NOT_IN_RANGE) {
              if (healersClose.length >= 2 || this.isCloseToExit(creep)) {
                creep.goTo(targetStructure);
              }
              creep.attack(targetStructure);
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

      const restSpot = findRestSpot(creep);
      if (restSpot) {
        creep.goTo(restSpot);
      }
    }
  }

  isCloseToExit(creep: Creep) {
    return creep.pos.x <= 2 || creep.pos.y <= 2 || creep.pos.x >= 48 || creep.pos.y >= 48;
  }
}

export const roleFighter = new RoleFighter();
