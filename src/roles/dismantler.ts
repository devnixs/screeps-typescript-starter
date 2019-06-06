import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "../utils/finder";
import { boostCreep } from "../utils/boost-manager";

export interface IDismantlerMemory extends CreepMemory {
  targetId?: string;
}

class RoleDismantler implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive === 1480) {
      creep.notifyWhenAttacked(false);
    }

    const attackFlag = Game.flags["dismantler_attack"];

    if (!attackFlag) {
      return;
    } else {
      if (attackFlag.pos && attackFlag.pos.roomName != creep.room.name) {
        creep.goTo(attackFlag);
        return;
      } else {
        const memory = creep.memory as IDismantlerMemory;

        let targetStructure: AnyStructure | null | undefined = memory.targetId
          ? Game.getObjectById(memory.targetId)
          : null;

        if (!targetStructure) {
          targetStructure = this.findTargetStructure(creep, attackFlag);
        }
        if (targetStructure) {
          memory.targetId = targetStructure.id;
          if (creep.dismantle(targetStructure) !== OK) {
            creep.goTo(targetStructure);
            creep.dismantle(targetStructure);
          }
        } else {
          creep.goTo(attackFlag);
        }
      }
    }
  }

  findTargetStructure(creep: Creep, attackFlag: Flag): AnyStructure | undefined | null {
    const targetStructures = creep.room.lookForAt(LOOK_STRUCTURES, attackFlag) as AnyStructure[];
    let targetStructure: AnyStructure | undefined | null = targetStructures[0];

    targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);

    return targetStructure;
  }
}

export const roleDismantler = new RoleDismantler();
