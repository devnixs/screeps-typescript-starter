import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot, findHostile } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { profiler } from "utils/profiler";

export interface IRemoteDefenderMemory extends CreepMemory {}

class RoleRemoteDefender implements IRole {
  run(creep: Creep) {
    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: IRemoteDefenderMemory = creep.memory as any;

    let hostile = findHostile(creep);

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

    // ATTACK MODE
    if (hostile) {
      creep.say("Yarr!", true);
      creep.attack(hostile);
      creep.rangedAttack(hostile);

      // find closest empty rempart
      const closestEmptyRempart = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: r =>
          r.structureType === "rampart" &&
          (r.pos.lookFor(LOOK_CREEPS).length === 0 || (r.pos.x === creep.pos.x && r.pos.y === creep.pos.y))
      });
      if (closestEmptyRempart) {
        if (closestEmptyRempart.pos.x !== creep.pos.x || closestEmptyRempart.pos.y !== creep.pos.y) {
          creep.goTo(closestEmptyRempart);
        }
      } else {
        creep.goTo(hostile);
      }

      return;
    } else {
      const keeperLair = creep.room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === "keeperLair" && s.ticksToSpawn && s.ticksToSpawn < 35
      })[0];
      if (keeperLair) {
        creep.goTo(keeperLair);
        return;
      }

      // PEACEFUL MODE
      if (!memory.subRole) {
        const rest = findRestSpot(creep, { x: 25, y: 25 });
        if (rest) {
          creep.say("Zzz");
          creep.goTo(rest);
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
              creep.say("Zzz");
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
    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
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
