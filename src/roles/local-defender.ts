import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot, findHostile } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { profiler } from "utils/profiler";

export interface ILocalDefenderMemory extends CreepMemory {}

class RoleLocalDefender implements IRole {
  run(creep: Creep) {
    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: ILocalDefenderMemory = creep.memory as any;

    let hostile = findHostile(creep);

    if (creep.hits < creep.hitsMax) {
      creep.rangedHeal(creep);
    }
    if (creep.hits < creep.hitsMax / 2) {
      creep.heal(creep);
    }

    // ATTACK MODE
    if (hostile) {
      creep.say("Yarr!", true);
      if (hostile.pos.isNearTo(creep)) {
        creep.rangedMassAttack();
      } else {
        creep.rangedAttack(hostile);
      }
    }

    const rampartTarget = hostile || creep;

    // find closest empty rempart
    const closestEmptyRempart = rampartTarget.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: r =>
        r.structureType === "rampart" &&
        (r.pos.lookFor(LOOK_CREEPS).length === 0 || (r.pos.x === creep.pos.x && r.pos.y === creep.pos.y))
    });
    if (closestEmptyRempart) {
      if (closestEmptyRempart.pos.x !== creep.pos.x || closestEmptyRempart.pos.y !== creep.pos.y) {
        creep.goTo(closestEmptyRempart);
      }
    } else {
      const rest = findRestSpot(creep, { x: 25, y: 25 });
      if (rest) {
        creep.say("Zzz");
        creep.goTo(rest);
      }
    }
  }
}

profiler.registerClass(RoleLocalDefender, "RoleLocalDefender");
export const roleLocalDefender = new RoleLocalDefender();
