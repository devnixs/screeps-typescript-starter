import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { AttackManager } from "managers/attack";

interface IAttackerMemory extends CreepMemory {
  attackPartyId: number;
  assigned: boolean;
}

class RoleAttacker implements IRole {
  run(creep: Creep) {
    const memory: IAttackerMemory = creep.memory as any;

    if (!memory.assigned && memory.attackPartyId) {
      AttackManager.assignToAttackParty(creep, memory.attackPartyId);
      memory.assigned = true;
    }

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
  }
}

export const roleAttacker = new RoleAttacker();
