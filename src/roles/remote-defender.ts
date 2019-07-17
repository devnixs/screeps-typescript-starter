import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot, findHostile, findEmptyRempart } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { profiler } from "utils/profiler";
import { getOffExit } from "utils/get-off-exits";
import { roleLocalDefender } from "./local-defender";
import { findOrCachePathfinding } from "utils/cached-pathfindings";

export interface IRemoteDefenderMemory extends CreepMemory {
  roomTarget?: string;
}

class RoleRemoteDefender implements IRole {
  run(creep: Creep) {
    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: IRemoteDefenderMemory = creep.memory as any;

    let hostile = findHostile(creep);
    if (hostile && creep.room.controller && creep.room.controller.my) {
      return roleLocalDefender.run(creep);
    }

    if (creep.hits < creep.hitsMax / 2) {
      creep.heal(creep);
      hostile && creep.rangedAttack(hostile);
      this.goHome(creep);
      return;
    }

    if (creep.hits < creep.hitsMax) {
      creep.heal(creep);
    } else {
      const damagedCreepInRange = creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: i => i.hits < i.hitsMax })[0];
      if (damagedCreepInRange) {
        if (damagedCreepInRange.pos.isNearTo(creep)) {
          creep.heal(damagedCreepInRange);
        } else {
          creep.rangedHeal(damagedCreepInRange);
        }
      }
    }

    if (getOffExit(creep) === OK) {
      return;
    }

    const rampartTarget = hostile || creep;

    // ATTACK MODE
    if (hostile) {
      creep.say("Yarr!", true);
      if (hostile.pos.isNearTo(creep)) {
        creep.rangedMassAttack();
      } else {
        creep.rangedAttack(hostile);
      }

      // find closest empty rempart
      const closestEmptyRempart = findEmptyRempart(rampartTarget, creep);
      if (closestEmptyRempart) {
        if (closestEmptyRempart.pos.x !== creep.pos.x || closestEmptyRempart.pos.y !== creep.pos.y) {
          creep.goTo(closestEmptyRempart);
        }
      } else {
        // kitting
        if (hostile.pos.getRangeTo(creep) < 3) {
          this.goHome(creep);
        } else if (hostile.pos.getRangeTo(creep) > 3) {
          creep.goTo(hostile);
        }
      }

      return;
    } else {
      const keeperLair = creep.room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === "keeperLair" && s.ticksToSpawn && s.ticksToSpawn < 40
      })[0];
      if (keeperLair) {
        // go between the keeper and the closest source to protect the harvester
        const closestSource = keeperLair.pos.findClosestByRange(FIND_SOURCES) as Source;
        const path = findOrCachePathfinding(keeperLair.pos, closestSource.pos);
        const middlePos = path.path.length / 2;
        const middle = path.path[Math.min(Math.min(middlePos, path.path.length - 1), 3)];

        creep.goTo(middle);
        return;
      }

      // PEACEFUL MODE
      if (!memory.subRole) {
        if (memory.homeRoom != creep.room.name) {
          const homeRoom = memory.roomTarget || creep.memory.homeRoom;
          creep.goTo(new RoomPosition(25, 25, homeRoom));
        } else {
          const rest = findRestSpot(creep, { x: 25, y: 25 });
          if (rest) {
            // creep.say("Zzz");
            creep.goTo(rest);
          }
        }
      } else {
        if (memory.subRole != creep.room.name) {
          const room = Game.rooms[memory.subRole];
          if (room) {
            const hostile = room.find(FIND_HOSTILE_CREEPS)[0];
            if (hostile) {
              creep.goTo(hostile);
            } else {
              room.controller && creep.goTo(room.controller);
            }
          } else {
            creep.goTo(new RoomPosition(25, 25, memory.subRole));
          }
          return;
        } else {
          const canHeal = creep.getActiveBodyparts(HEAL);
          if (!canHeal || this.healFriends(creep) === -1) {
            const rest = findRestSpot(creep, { x: 25, y: 25 });
            if (rest) {
              // creep.say("Zzz");
              creep.goTo(rest);
            }
          }
        }
      }
    }
  }

  healFriends(creep: Creep) {
    const damagedCreep = creep.room.find(FIND_MY_CREEPS, { filter: creep => creep.hits < creep.hitsMax })[0];
    if (damagedCreep) {
      creep.goTo(damagedCreep);
      if (damagedCreep.pos.isNearTo(creep)) {
        creep.heal(damagedCreep);
      } else {
        creep.rangedHeal(damagedCreep);
      }
      return OK;
    } else {
      return -1;
    }
  }

  goHome(creep: Creep) {
    const homeRoom = (creep.memory as IRemoteDefenderMemory).roomTarget || creep.memory.homeRoom;

    if (creep.room.name !== homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, homeRoom || ""));
      return;
    }
  }

  needsHealing(creep: Creep) {
    const toughParts = creep.body.filter(i => i.type === "tough");
    const totalToughHits = toughParts.length * 100;
    const actualToughHits = toughParts.reduce((acc, part) => acc + part.hits, 0);
    return totalToughHits > 0 && actualToughHits <= totalToughHits / 2;
  }
  isFullyHealed(creep: Creep) {
    const toughParts = creep.body.filter(i => i.type === "tough");
    const totalToughHits = toughParts.length * 100;
    const actualToughHits = toughParts.reduce((acc, part) => acc + part.hits, 0);
    return totalToughHits > 0 && actualToughHits >= totalToughHits * 0.8;
  }
}

profiler.registerClass(RoleRemoteDefender, "RoleRemoteDefender");
export const roleRemoteDefender = new RoleRemoteDefender();
