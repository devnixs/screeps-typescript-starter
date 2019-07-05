import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot, findHostile } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { profiler } from "utils/profiler";

export interface IRemoteDefenderMemory extends CreepMemory {
  status: "healing" | "attacking";
}

class RoleRemoteDefender implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive === 1480) {
      creep.notifyWhenAttacked(false);
    }

    if (boostCreep(creep) === OK) {
      // Don't do anything else
      return;
    } else {
    }

    if (creep.memory.subRole === "stop") {
      return;
    }

    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: IRemoteDefenderMemory = creep.memory as any;

    let hostile = findHostile(creep);

    const canHeal = creep.getActiveBodyparts(HEAL);

    if (hostile) {
      if (hostile.pos.isNearTo(creep.pos)) {
        creep.attack(hostile);
      }
    }

    if (creep.fatigue > 0) {
      creep.heal(creep);
      return;
    }

    if (!memory.status) {
      memory.status = "attacking";
    }

    if (memory.status === "attacking" && canHeal) {
      const needsHealing = this.needsHealing(creep);
      if (needsHealing) {
        memory.status = "healing";
      }
    }

    if (memory.status === "healing" && canHeal) {
      const isFullyHealed = this.isFullyHealed(creep);
      if (isFullyHealed) {
        memory.status = "attacking";
      }
    }

    if (memory.status === "healing" && canHeal) {
      creep.heal(creep);
      creep.goTo(hostile);
    } else {
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
          if (hostile) {
            creep.say("Yarr!", true);
            creep.goTo(hostile);
          } else {
            this.reassign(creep);
            if (this.healFriends(creep) === -1) {
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
