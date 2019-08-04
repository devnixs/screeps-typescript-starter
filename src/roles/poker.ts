import { sing } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { PokingManager } from "managers/poking";

export interface IPokerMemory extends CreepMemory {
  targetRoom: string;
  needsReassignment: boolean;
}

class RolePoker implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive && creep.ticksToLive >= CREEP_LIFE_TIME - 5) {
      creep.notifyWhenAttacked(false);
    }
    const memory = creep.memory as IPokerMemory;

    const enemies = creep.room.find(FIND_HOSTILE_CREEPS);
    const dangerousEnemies = enemies.filter(i => i.getActiveBodyparts(ATTACK) || i.getActiveBodyparts(RANGED_ATTACK));
    const pacisfistEnemies = _.difference(enemies, dangerousEnemies);

    const dangerousClose = dangerousEnemies.find(i => i.pos.getRangeTo(creep) < 12);
    if (dangerousClose) {
      sing(creep, ["😱", "Leave me", "Alone! 😱", "I'm just", "doing my", "job 😨"]);
      memory.needsReassignment = true;
      this.goHome(creep);
      return;
    }

    if (creep.pos.roomName !== memory.targetRoom) {
      if (memory.needsReassignment) {
        PokingManager.reassign(creep);
      }

      creep.goTo(new RoomPosition(25, 25, memory.targetRoom), { preferHighway: false });
    } else {
      let target: Creep | AnyStructure | undefined = pacisfistEnemies[0];
      target = target || creep.room.find(FIND_STRUCTURES, { filter: i => i.structureType === "container" })[0];
      target = target || creep.room.find(FIND_STRUCTURES, { filter: i => i.structureType === "road" })[0];

      if (target) {
        sing(creep, ["Hello 😇", "😘"]);
        if (creep.pos.isNearTo(target.pos)) {
          creep.attack(target);
        } else {
          creep.goTo(target);
        }
        return;
      }
    }
  }
  goHome(creep: Creep) {
    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
      return;
    }
  }
}

profiler.registerClass(RolePoker, "RolePoker");

export const rolePoker = new RolePoker();
