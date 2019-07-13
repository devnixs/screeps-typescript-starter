import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot, findHostile, findEmptyRempart } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { profiler } from "utils/profiler";

export interface ILocalDefenderMemory extends CreepMemory {}

class RoleLocalDefender implements IRole {
  run(creep: Creep) {
    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: ILocalDefenderMemory = creep.memory as any;

    if (boostCreep(creep) === OK) {
      return;
    }

    let hostile = findHostile(creep);

    if (creep.hits < creep.hitsMax) {
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

    let doNotMove = false;
    if (creep.hits < creep.hitsMax * 0.75) {
      // don't move if we're safe but damaged
      const rempartOnTopOfUs = creep.pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType === "rampart");
      if (rempartOnTopOfUs) {
        doNotMove = true;
      }
    }

    const rampartTarget = hostile || creep;

    const closestEmptyRempart = findEmptyRempart(rampartTarget, creep);
    if (closestEmptyRempart && !doNotMove) {
      if (closestEmptyRempart.pos.x !== creep.pos.x || closestEmptyRempart.pos.y !== creep.pos.y) {
        creep.goTo(closestEmptyRempart);
      }
    } else {
      const rest = findRestSpot(creep, { x: 25, y: 25 });
      if (rest && !doNotMove) {
        creep.say("Zzz");
        creep.goTo(rest);
      }
    }
  }
}

profiler.registerClass(RoleLocalDefender, "RoleLocalDefender");
export const roleLocalDefender = new RoleLocalDefender();
