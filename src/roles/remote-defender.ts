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

    const canHeal = creep.getActiveBodyparts(HEAL);

    // ATTACK MODE
    if (hostile) {
      const isFar = hostile.pos.getRangeTo(creep.pos) > 4;
      if (isFar && creep.hits < creep.hitsMax) {
        // heal self before engaging next combat.
        creep.heal(creep);
        return;
      }

      if (hostile.pos.isNearTo(creep.pos)) {
        creep.attack(hostile);
      } else {
        creep.say("Yarr!", true);
        creep.goTo(hostile);
        if (canHeal) {
          creep.heal(creep);
        }
      }
      return;
    } else {
      // PEACEFUL MODE
      if (creep.hits < creep.hitsMax) {
        creep.heal(creep);
      }

      if (!memory.subRole) {
        this.goHome(creep);
        return;
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
          if (this.healFriends(creep) === -1) {
            this.reassign(creep);
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

  reassign(creep: Creep) {
    const homeRoom = Game.rooms[creep.memory.homeRoom];
    if (homeRoom) {
      const needsDefense = homeRoom.memory.needsDefenders[0];
      if (needsDefense) {
        const memory = creep.memory as IRemoteDefenderMemory;
        memory.subRole = needsDefense.room;
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
