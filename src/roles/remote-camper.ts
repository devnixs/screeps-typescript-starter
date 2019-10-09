import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { roleBuilder } from "./builder";
import { findRestSpot, findHostile } from "utils/finder";
import { profiler } from "../utils/profiler";
import { getOffExit } from "utils/get-off-exits";
import { whitelist } from "constants/misc";
import { Traveler } from "utils/Traveler";
import { flee } from "utils/misc-utils";

interface IRemoteCamperMemory extends CreepMemory {
  lastActionTime: number | undefined;
}

class RoleRemoteCamper implements IRole {
  run(creep: Creep) {
    const memory: IRemoteCamperMemory = creep.memory as any;

    const subRole = creep.memory.subRole || "";
    let target = subRole;
    if (target.indexOf("-") >= 0) {
      target = target.split("-")[0];
    }
    if (!target) {
      this.goToRest(creep);
      return;
    }

    if (getOffExit(creep) === OK) {
      return;
    }

    const enemy = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
      filter: i => whitelist.indexOf(i.owner.username) === -1
    });

    if (enemy && enemy.pos.isNearTo(creep)) {
      creep.attack(enemy);
    }

    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL)) {
      creep.heal(creep);

      if (creep.hits < creep.hitsMax * 0.75) {
        flee(creep);
        return;
      }
    } else if (creep.getActiveBodyparts(HEAL)) {
      const damagedFriend = creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: i => i.hits < i.hitsMax })[0];
      if (damagedFriend) {
        if (damagedFriend.pos.isNearTo(creep)) {
          creep.heal(damagedFriend);
        } else {
          creep.rangedHeal(damagedFriend);
        }
      }
    }

    let idle = true;
    if (creep.pos.roomName === target) {
      if (creep.getActiveBodyparts(ATTACK)) {
        if (enemy) {
          if (enemy.pos.isNearTo(creep)) {
            creep.attack(enemy);
          } else {
            creep.goTo(enemy, {
              range: 1,
              offRoad: true,
              roomCallback: (roomName, matrix) => (roomName === creep.room.name ? matrix : false)
            });
          }
          idle = false;
        }
      }

      if (idle && creep.getActiveBodyparts(RANGED_ATTACK)) {
        if (enemy) {
          if (enemy.pos.isNearTo(creep)) {
            creep.rangedMassAttack();
          } else if (enemy.pos.inRangeTo(creep, 3)) {
            creep.rangedAttack(enemy);
          } else {
            creep.goTo(enemy, {
              range: 3,
              offRoad: true,
              roomCallback: (roomName, matrix) => (roomName === creep.room.name ? matrix : false)
            });
          }
          idle = false;
        }
      }

      if (idle && creep.getActiveBodyparts(HEAL)) {
        const damagedFriend = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: i => i.hits < i.hitsMax && i.id !== creep.id
        });
        if (damagedFriend) {
          creep.goTo(damagedFriend, { range: 1 });
          idle = false;
        } else {
          const otherCreep = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: i => i.getActiveBodyparts(ATTACK) || i.getActiveBodyparts(RANGED_ATTACK)
          });
          if (otherCreep) {
            creep.goTo(otherCreep, { range: 1 });
            idle = false;
          }
        }
      }

      if (!idle) {
        memory.lastActionTime = Game.time;
      }
      if (idle && creep.room.controller && memory.lastActionTime && memory.lastActionTime < Game.time - 10) {
        creep.goTo(creep.room.controller, { range: 4 });
      }
    } else {
      creep.goTo(new RoomPosition(25, 25, target));
    }
  }

  goToRest(creep: Creep) {
    const rest = findRestSpot(creep);
    if (rest) {
      creep.goTo(rest, { range: 4 });
    }
  }
}

profiler.registerClass(RoleRemoteCamper, "RoleRemoteCamper");
export const roleRemoteCamper = new RoleRemoteCamper();
