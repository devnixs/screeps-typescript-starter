import { defaultReusePath, requiredHealersForAnAttack } from "../constants/misc";
import { notify } from "../utils/notify";
import { findEmptySpotCloseTo, findRestSpot } from "utils/finder";

interface IFighterMemory extends CreepMemory {
  assignedExplorerName: string | null;
}

class RoleFighter implements IRole {
  run(creep: Creep) {
    const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);

    let hostile: Creep | null = null;
    _.forEach(rooms, room => {
      if (room.controller && !room.controller.my) {
        return;
      }
      hostile = room.find(FIND_HOSTILE_CREEPS)[0];
      // no need tok look for another hostile.
      if (hostile) {
        return false;
      } else {
        return true;
      }
    });

    if (hostile) {
      notify("Hostile creep detected (time=" + Game.time + ")! " + JSON.stringify(hostile), 200);
    }

    const memory: IFighterMemory = creep.memory as any;

    if (hostile) {
      if (creep.attack(hostile) == ERR_NOT_IN_RANGE) {
        creep.goTo(hostile);
      }
    } else {
      const attackFlag = Game.flags["fighter_attack"];
      const healersReady = creep.pos.findInRange(FIND_MY_CREEPS, 4, { filter: i => i.memory.role === "healer" });

      if (attackFlag && healersReady.length >= requiredHealersForAnAttack) {
        if (attackFlag.room && attackFlag.room.name === creep.room.name) {
          // we need at least two healers close
          const healersClose = creep.pos.findInRange(FIND_MY_CREEPS, 1, { filter: i => i.memory.role === "healer" });
          console.log(creep.name + "> Found " + healersClose.length + " healers close");

          const targetStructures = creep.room.lookForAt(LOOK_STRUCTURES, attackFlag);
          const targetStructure = targetStructures[0];
          if (targetStructure) {
            if (creep.attack(targetStructure) === ERR_NOT_IN_RANGE) {
              if (healersClose.length >= 2) {
                creep.goTo(targetStructure);
              }
              creep.attack(targetStructure);
            }
          } else {
            // look for an enemy
            var hostileCreep = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (hostileCreep) {
              if (creep.attack(hostileCreep) === ERR_NOT_IN_RANGE) {
                if (healersClose.length >= 2) {
                  creep.goTo(hostileCreep);
                }
                creep.attack(hostileCreep);
              }
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
}

export const roleFighter = new RoleFighter();
