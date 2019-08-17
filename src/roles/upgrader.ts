import { sourceManager } from "../utils/source-manager";
import { profiler } from "../utils/profiler";

interface IUpgraderMemory extends CreepMemory {
  upgrading: boolean;
  beenCloseToCtrl: boolean;
}

class RoleUpgrader implements IRole {
  run(creep: Creep) {
    if (!creep.room.controller) {
      return;
    }
    creep.memory.s = Game.time;

    const isCloseToController = creep.room.controller.pos.getRangeTo(creep.pos) <= 5;
    const container = Game.getObjectById(creep.room.memory.controllerContainer) as StructureContainer | undefined;
    const memory: IUpgraderMemory = creep.memory as any;
    if (memory.upgrading && creep.carry.energy == 0) {
      memory.upgrading = false;
    }

    if (
      !memory.upgrading &&
      (isCloseToController ? creep.carry.energy > 0 : creep.carry.energy === creep.carryCapacity)
    ) {
      memory.upgrading = true;
    }
    if (Game.time % 101 === 0) {
      const creepOnTopOfContainer = container && container.pos.lookFor(LOOK_CREEPS)[0];
      if (creepOnTopOfContainer) {
        if (creepOnTopOfContainer.id !== creep.id) {
          creep.goTo(creep.room.controller, { range: 1 });
        }
      } else if (container) {
        creep.goTo(container, { range: 0 });
      }
    }

    if (memory.upgrading) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.goTo(creep.room.controller);
      } else {
        this.withdrawFromProximityStorageIfPossible(creep);
      }
    } else {
      // use container or link in priority
      const outputLink = creep.room.memory.links && creep.room.memory.links.find(i => i.type === "output");
      const outputLinkObj = outputLink && (Game.getObjectById(outputLink.id) as StructureLink | undefined);
      if (container && container.pos.inRangeTo(creep, 3)) {
        if (container.pos.isNearTo(creep)) {
          creep.withdraw(container, "energy");
          memory.upgrading = true;
        } else {
          creep.goTo(container);
        }
      } else if (outputLinkObj && outputLinkObj.pos.inRangeTo(creep, 3) && outputLinkObj.energy > 0) {
        if (outputLinkObj.pos.isNearTo(creep)) {
          creep.withdraw(outputLinkObj, "energy");
          memory.upgrading = true;
        } else {
          creep.goTo(outputLinkObj);
        }
      } else {
        sourceManager.getEnergy(creep);
      }
    }
  }

  withdrawFromProximityStorageIfPossible(creep: Creep) {
    // only if we're gonna run out of energy soon, to save CPU
    const almostDepleted = creep.getActiveBodyparts(WORK) > creep.carry.energy;
    if (!almostDepleted) {
      return;
    }

    const container = Game.getObjectById(creep.room.memory.controllerContainer) as StructureContainer | undefined;
    const outputLink = creep.room.memory.links && creep.room.memory.links.find(i => i.type === "output");
    const outputLinkObj = outputLink && (Game.getObjectById(outputLink.id) as StructureLink | undefined);
    if (container && container.pos.isNearTo(creep) && container.store.energy > 0) {
      creep.withdraw(container, "energy");
    } else if (outputLinkObj && outputLinkObj.pos.isNearTo(creep) && outputLinkObj.energy > 0) {
      creep.withdraw(outputLinkObj, "energy");
    }
  }
}

profiler.registerClass(RoleUpgrader, "RoleUpgrader");
export const roleUpgrader = new RoleUpgrader();
