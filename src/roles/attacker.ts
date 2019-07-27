import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { AttackManager } from "managers/attack";

export interface IAttackerMemory extends CreepMemory {
  ready: boolean;
}

class RoleAttacker implements IRole {
  run(creep: Creep) {
    const memory: IAttackerMemory = creep.memory as any;
    if (creep.ticksToLive === 1480) {
      creep.notifyWhenAttacked(false);
    }

    if (boostCreep(creep) === OK) {
      // Don't do anything else
      return;
    }

    if (creep.memory.subRole === "stop") {
      return;
    }

    memory.ready = true;

    const attack = Memory.attack;
    if (!attack) {
      console.log("No current attack. Suiciding.");
      creep.suicide();
      return;
    }
    const party = attack.parties.find(i => (i.creeps.find(j => j.name === creep.name) ? true : false));
    if (!party) {
      console.log("Attack party not found. Suiciding.");
      creep.suicide();
      return;
    }
  }
}

export const roleAttacker = new RoleAttacker();
